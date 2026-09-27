package com.buildplan.preview.evidence

import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.camera.OrbitPose
import com.buildplan.preview.camera.Projection
import com.buildplan.preview.math.Vec3
import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.presentation.ScenePresentation
import com.buildplan.preview.presentation.StudyPalette
import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.render.SurfaceAppearance
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.TangentFrames
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.tan

/**
 * A small software rasteriser for EVIDENCE ONLY: it draws the exact buffers
 * the Filament renderer uploads — the compiled surfaces, the derived feature
 * edges, the derived roof covering — with the same camera arithmetic
 * (`OrbitCamera`), the same visibility and edge rules, and the same material
 * values per mode, so a reviewer without a GPU can see what each mode adds.
 *
 * It is NOT Filament: plain Lambert light, no shadows, no ambient occlusion,
 * no tone mapping curve, no MSAA/FXAA (4× supersampling instead). What it can
 * show is geometry: which lines are inked, where tiles are laid and dropped,
 * that glass is a sheet and not a slab. Light and material quality can only
 * be judged on the device.
 */
class PresentationRaster(private val width: Int, private val height: Int, private val supersample: Int = 3) {

    private val w = width * supersample
    private val h = height * supersample
    private val color = FloatArray(w * h * 3)
    private val depth = FloatArray(w * h)

    /** Lambert terms per mode: ambient and sun, in display units. */
    private fun lightOf(mode: PresentationMode): Pair<Float, Float> = when (mode) {
        PresentationMode.MODEL -> 0.42f to 0.62f
        PresentationMode.CLAY -> 0.48f to 0.62f
        PresentationMode.LINE -> 0.86f to 0.18f
    }

    /** The key light's direction of travel, as the renderer's sun. */
    private val sunDirection = Vec3(0.45, -0.82, -0.35).normalized()

    fun render(
        scene: ModelScene,
        presentation: ScenePresentation,
        mode: PresentationMode,
        visible: Set<String>,
        camera: OrbitCamera,
        pose: OrbitPose,
        style: RenderStyle = RenderStyle.CONSTRUCTION,
    ): RgbImage {
        val look = mode.look(style)
        val bg = look.background
        for (i in 0 until w * h) {
            color[i * 3] = bg[0]; color[i * 3 + 1] = bg[1]; color[i * 3 + 2] = bg[2]
            depth[i] = Float.POSITIVE_INFINITY
        }
        val view = ViewTransform(camera, pose, w.toDouble(), h.toDouble())
        val (ambient, sun) = lightOf(mode)

        // Opaque surfaces, then the covering.
        val translucent = ArrayList<Pair<FloatArray, SurfaceAppearance>>()
        for (obj in scene.objects) {
            if (obj.id !in visible) continue
            for (part in obj.parts) {
                val a = if (mode.usesStyle) style.appearanceOf(part, part.materialId?.let { scene.materials[it] }, scene.styling) else StudyPalette.appearanceOf(mode, part)
                val tris = obj.positions.copyOfRange(part.first * 3, (part.first + part.count) * 3)
                if (part.part.isTranslucent) {
                    translucent.add(tris to a)
                    continue
                }
                for (t in 0 until tris.size / 9) triangle(view, tris, t * 9, a, ambient, sun, blend = false, depthBias = look.surfaceDepthOffset > 0f)
            }
            if (mode.showsRoofCover) {
                presentation.coverByObject[obj.id]?.let { cover ->
                    val a = StudyPalette.coverAppearance()
                    val tri = FloatArray(9)
                    for (t in 0 until cover.indices.size / 3) {
                        for (v in 0 until 3) {
                            val idx = cover.indices[t * 3 + v]
                            tri[v * 3] = cover.positions[idx * 3]; tri[v * 3 + 1] = cover.positions[idx * 3 + 1]; tri[v * 3 + 2] = cover.positions[idx * 3 + 2]
                        }
                        // Shade by the first corner's own normal, read back from its tangent frame.
                        val i0 = cover.indices[t * 3]
                        val q = floatArrayOf(cover.tangents[i0 * 4], cover.tangents[i0 * 4 + 1], cover.tangents[i0 * 4 + 2], cover.tangents[i0 * 4 + 3])
                        val n = TangentFrames.rotate(q, Vec3(0.0, 0.0, 1.0))
                        triangle(view, tri, 0, a, ambient, sun, blend = false, depthBias = true, normal = n)
                    }
                }
            }
        }

        // Grid, depth tested, never writing depth.
        drawGrid(view, scene, look.grid)

        // Lines, as the line material: depth tested against the surfaces, blended, no depth write.
        val tiers = mode.edgeTiers
        if (tiers.isNotEmpty()) {
            val drawn = presentation.edges.drawn(visible, tiers, null)
            val arrays = drawn.merged.map { presentation.edges.merged[it].positions } + drawn.perObject.map { presentation.edges.groups[it].positions }
            for (p in arrays) for (s in 0 until p.size / 6) line(view, p, s * 6, look.edgeInk)
        }

        // Translucent parts last, far to near, blended as Filament's transparent path does.
        val glassTris = ArrayList<Triple<Double, FloatArray, SurfaceAppearance>>()
        for ((tris, a) in translucent) for (t in 0 until tris.size / 9) {
            val c = Vec3((tris[t * 9] + tris[t * 9 + 3] + tris[t * 9 + 6]) / 3.0, (tris[t * 9 + 1] + tris[t * 9 + 4] + tris[t * 9 + 7]) / 3.0, (tris[t * 9 + 2] + tris[t * 9 + 5] + tris[t * 9 + 8]) / 3.0)
            glassTris.add(Triple(view.depthOf(c), tris.copyOfRange(t * 9, t * 9 + 9), a))
        }
        glassTris.sortByDescending { it.first }
        for ((_, tri, a) in glassTris) triangle(view, tri, 0, a, ambient, sun, blend = true, depthBias = false)

        return resolve()
    }

    private fun drawGrid(view: ViewTransform, scene: ModelScene, grid: FloatArray) {
        val b = scene.bounds
        val pad = max(2.0, b.radius * 0.35)
        val minX = floor(b.min.x - pad); val maxX = floor(b.max.x + pad) + 1
        val minZ = floor(b.min.z - pad); val maxZ = floor(b.max.z + pad) + 1
        val y = (b.min.y - 0.01).toFloat()
        // As the line material receives it: blended source-over, the colour taken as given.
        val ink = grid
        var x = minX
        while (x <= maxX) { line(view, floatArrayOf(x.toFloat(), y, minZ.toFloat(), x.toFloat(), y, maxZ.toFloat()), 0, ink, thin = true); x += 1.0 }
        var z = minZ
        while (z <= maxZ) { line(view, floatArrayOf(minX.toFloat(), y, z.toFloat(), maxX.toFloat(), y, z.toFloat()), 0, ink, thin = true); z += 1.0 }
    }

    private fun triangle(
        view: ViewTransform,
        p: FloatArray,
        o: Int,
        a: SurfaceAppearance,
        ambient: Float,
        sun: Float,
        blend: Boolean,
        depthBias: Boolean,
        normal: Vec3? = null,
    ) {
        val va = Vec3(p[o].toDouble(), p[o + 1].toDouble(), p[o + 2].toDouble())
        val vb = Vec3(p[o + 3].toDouble(), p[o + 4].toDouble(), p[o + 5].toDouble())
        val vc = Vec3(p[o + 6].toDouble(), p[o + 7].toDouble(), p[o + 8].toDouble())
        val n = normal ?: ((vb - va) cross (vc - va)).normalized()
        // Back faces: the technical material culls them; the translucent one is two-sided.
        val toEye = view.toEye(va)
        if (!blend && (n dot toEye) <= 0.0) return
        val facing = if ((n dot toEye) < 0.0) n * -1.0 else n
        val diffuse = max(0.0, facing dot (sunDirection * -1.0)).toFloat()
        val k = ambient + sun * diffuse
        val sa = view.project(va) ?: return
        val sb = view.project(vb) ?: return
        val sc = view.project(vc) ?: return
        val minX = max(0, floor(min(sa[0], min(sb[0], sc[0]))).toInt())
        val maxX = min(w - 1, floor(max(sa[0], max(sb[0], sc[0]))).toInt() + 1)
        val minY = max(0, floor(min(sa[1], min(sb[1], sc[1]))).toInt())
        val maxY = min(h - 1, floor(max(sa[1], max(sb[1], sc[1]))).toInt() + 1)
        val area = edge(sa, sb, sc[0], sc[1])
        if (abs(area) < 1e-12) return
        val bias = if (depthBias) 1.0005f else 1f
        for (y in minY..maxY) for (x in minX..maxX) {
            val px = x + 0.5; val py = y + 0.5
            val w0 = edge(sb, sc, px, py) / area
            val w1 = edge(sc, sa, px, py) / area
            val w2 = edge(sa, sb, px, py) / area
            if (w0 < 0 || w1 < 0 || w2 < 0) continue
            // Depth is linear in screen space only as its reciprocal under a perspective projection.
            val z = (if (view.perspective) 1.0 / (w0 / sa[2] + w1 / sb[2] + w2 / sc[2]) else w0 * sa[2] + w1 * sb[2] + w2 * sc[2]).toFloat() * bias
            val i = y * w + x
            if (z >= depth[i]) continue
            if (blend) {
                // Premultiplied source-over: rgb + (1 - alpha) * destination.
                color[i * 3] = a.red * k + (1 - a.alpha) * color[i * 3]
                color[i * 3 + 1] = a.green * k + (1 - a.alpha) * color[i * 3 + 1]
                color[i * 3 + 2] = a.blue * k + (1 - a.alpha) * color[i * 3 + 2]
            } else {
                depth[i] = z
                color[i * 3] = a.red * k; color[i * 3 + 1] = a.green * k; color[i * 3 + 2] = a.blue * k
            }
        }
    }

    private fun line(view: ViewTransform, p: FloatArray, o: Int, ink: FloatArray, thin: Boolean = false) {
        val a = view.project(Vec3(p[o].toDouble(), p[o + 1].toDouble(), p[o + 2].toDouble())) ?: return
        val b = view.project(Vec3(p[o + 3].toDouble(), p[o + 4].toDouble(), p[o + 5].toDouble())) ?: return
        val steps = max(1, (max(abs(b[0] - a[0]), abs(b[1] - a[1])) * 1.5).roundToInt())
        val half = if (thin) 0 else supersample / 2
        for (s in 0..steps) {
            val t = s.toDouble() / steps
            val x = a[0] + (b[0] - a[0]) * t
            val y = a[1] + (b[1] - a[1]) * t
            val z = (if (view.perspective) 1.0 / ((1 - t) / a[2] + t / b[2]) else a[2] + (b[2] - a[2]) * t).toFloat()
            for (dy in -half..half) for (dx in -half..half) {
                val ix = x.toInt() + dx; val iy = y.toInt() + dy
                if (ix < 0 || iy < 0 || ix >= w || iy >= h) continue
                val i = iy * w + ix
                if (z > depth[i] * 1.0002f) continue
                color[i * 3] = ink[0] + (1 - ink[3]) * color[i * 3]
                color[i * 3 + 1] = ink[1] + (1 - ink[3]) * color[i * 3 + 1]
                color[i * 3 + 2] = ink[2] + (1 - ink[3]) * color[i * 3 + 2]
            }
        }
    }

    private fun edge(a: DoubleArray, b: DoubleArray, x: Double, y: Double): Double = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])

    private fun resolve(): RgbImage {
        val img = RgbImage(width, height)
        val n = supersample * supersample
        for (y in 0 until height) for (x in 0 until width) {
            var r = 0f; var g = 0f; var b = 0f
            for (sy in 0 until supersample) for (sx in 0 until supersample) {
                val i = (y * supersample + sy) * w + (x * supersample + sx)
                r += color[i * 3]; g += color[i * 3 + 1]; b += color[i * 3 + 2]
            }
            img.set(x, y, (toSrgb(r / n) shl 16) or (toSrgb(g / n) shl 8) or toSrgb(b / n))
        }
        return img
    }

    private fun toSrgb(linear: Float): Int {
        val c = linear.coerceIn(0f, 1f)
        val s = if (c <= 0.0031308f) c * 12.92f else 1.055f * c.toDouble().pow(1.0 / 2.4).toFloat() - 0.055f
        return (s * 255f).roundToInt().coerceIn(0, 255)
    }

    /** The app's own camera, as a projection onto the supersampled image. */
    private class ViewTransform(camera: OrbitCamera, private val pose: OrbitPose, private val pixelsWide: Double, private val pixelsHigh: Double) {
        private val aspect = pixelsWide / pixelsHigh
        private val eye = camera.eye(pose)
        private val basis = camera.basis(pose)
        private val halfH = if (pose.projection == Projection.ORTHOGRAPHIC) camera.orthoHalfHeight(pose) else tan(Math.toRadians(camera.fovDeg) / 2.0)

        val perspective = pose.projection != Projection.ORTHOGRAPHIC

        fun toEye(p: Vec3): Vec3 = if (pose.projection == Projection.ORTHOGRAPHIC) basis.forward * -1.0 else eye - p

        fun depthOf(p: Vec3): Double = (p - eye) dot basis.forward

        /** Pixel x, pixel y (down), depth; null behind the camera. */
        fun project(p: Vec3): DoubleArray? {
            val d = p - eye
            val z = d dot basis.forward
            if (z <= 0.05) return null
            val x = d dot basis.right
            val y = d dot basis.up
            val nx: Double
            val ny: Double
            if (pose.projection == Projection.ORTHOGRAPHIC) {
                nx = x / (halfH * aspect); ny = y / halfH
            } else {
                nx = x / (z * halfH * aspect); ny = y / (z * halfH)
            }
            return doubleArrayOf((nx + 1.0) / 2.0 * pixelsWide, (1.0 - ny) / 2.0 * pixelsHigh, z)
        }
    }

    init {
        require(width > 0 && height > 0 && supersample > 0)
    }
}

/** A plain RGB raster and a PNG writer: the unit-test classpath is android.jar, which has no AWT or ImageIO. */
class RgbImage(val width: Int, val height: Int) {
    val pixels = IntArray(width * height)

    fun set(x: Int, y: Int, rgb: Int) { pixels[y * width + x] = rgb }

    fun get(x: Int, y: Int): Int = pixels[y * width + x]

    fun fill(rgb: Int) = pixels.fill(rgb)

    /** Copies [other] with its top-left corner at ([x], [y]). */
    fun draw(other: RgbImage, x: Int, y: Int) {
        for (row in 0 until other.height) for (col in 0 until other.width) {
            val tx = x + col; val ty = y + row
            if (tx in 0 until width && ty in 0 until height) set(tx, ty, other.get(col, row))
        }
    }

    fun writePng(file: java.io.File) {
        val raw = java.io.ByteArrayOutputStream()
        for (y in 0 until height) {
            raw.write(0)
            for (x in 0 until width) {
                val p = pixels[y * width + x]
                raw.write((p shr 16) and 0xff); raw.write((p shr 8) and 0xff); raw.write(p and 0xff)
            }
        }
        val out = java.io.DataOutputStream(java.io.BufferedOutputStream(java.io.FileOutputStream(file)))
        out.use { o ->
            o.write(byteArrayOf(0x89.toByte(), 'P'.code.toByte(), 'N'.code.toByte(), 'G'.code.toByte(), 13, 10, 26, 10))
            fun chunk(type: String, data: ByteArray) {
                o.writeInt(data.size)
                val typeBytes = type.toByteArray(Charsets.US_ASCII)
                o.write(typeBytes); o.write(data)
                val crc = java.util.zip.CRC32()
                crc.update(typeBytes); crc.update(data)
                o.writeInt(crc.value.toInt())
            }
            val header = java.io.ByteArrayOutputStream()
            java.io.DataOutputStream(header).apply { writeInt(width); writeInt(height); writeByte(8); writeByte(2); writeByte(0); writeByte(0); writeByte(0) }
            chunk("IHDR", header.toByteArray())
            val compressed = java.io.ByteArrayOutputStream()
            java.util.zip.DeflaterOutputStream(compressed, java.util.zip.Deflater(9)).use { it.write(raw.toByteArray()) }
            chunk("IDAT", compressed.toByteArray())
            chunk("IEND", ByteArray(0))
        }
    }
}
