package com.buildplan.preview.evidence

import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.camera.OrbitPose
import com.buildplan.preview.camera.Projection
import com.buildplan.preview.math.Vec3
import com.buildplan.preview.presentation.GroundFootprint
import com.buildplan.preview.presentation.PresentationLook
import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.presentation.ScenePresentation
import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.render.SurfaceAppearance
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.TangentFrames
import kotlin.math.PI
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
 * edges, the derived roof covering, the ground sheet — with the same camera
 * arithmetic (`OrbitCamera`), the same visibility and edge rules, and the same
 * material values per mode (`PresentationMode.appearanceOf`), so a reviewer
 * without a GPU can see what each mode adds.
 *
 * It is NOT Filament. Light is the look's own numbers through the viewer's
 * fixed exposure — Lambert sun (strength, colour, direction) plus the tinted
 * sky fill's constant and vertical terms — then a filmic curve standing in
 * for Filament's default tone mapper; no shadows, no ambient occlusion, no
 * specular, no MSAA/FXAA (supersampling instead). Draw order follows
 * Filament's passes: opaque surfaces, then translucent surfaces far to near,
 * then feature edges, then the grid. What it shows reliably is geometry and
 * the palettes' relations: which lines are inked, where tiles are laid, that
 * glass is a sheet, how values and hues sit against each other. Light and
 * material quality can only be judged on the device.
 */
class PresentationRaster(private val width: Int, private val height: Int, private val supersample: Int = 3) {

    private val w = width * supersample
    private val h = height * supersample
    private val color = FloatArray(w * h * 3)
    private val depth = FloatArray(w * h)

    /** A look's light in display units: the sky fill's two terms and the sun, per channel. */
    private class Light(val skyConstant: FloatArray, val skyFromAbove: FloatArray, val sun: FloatArray, val towardsSun: Vec3)

    private fun lightOf(look: PresentationLook): Light {
        val sh = look.harmonics()
        val sky = look.ambientIntensity * EXPOSURE
        val sun = look.sunLux * EXPOSURE / PI.toFloat()
        val d = look.sunDirection
        return Light(
            skyConstant = FloatArray(3) { sh[it] * sky },
            skyFromAbove = FloatArray(3) { sh[3 + it] * sky },
            sun = FloatArray(3) { look.sunColor[it] * sun },
            towardsSun = Vec3(-d[0].toDouble(), -d[1].toDouble(), -d[2].toDouble()).normalized(),
        )
    }

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
        val light = lightOf(look)
        val footprint = GroundFootprint.of(scene.bounds)

        // The opaque pass: surfaces, the covering, the ground sheet.
        val translucent = ArrayList<Pair<FloatArray, SurfaceAppearance>>()
        for (obj in scene.objects) {
            if (obj.id !in visible) continue
            for (part in obj.parts) {
                val a = mode.appearanceOf(style, part, part.materialId?.let { scene.materials[it] }, scene.styling)
                val tris = obj.positions.copyOfRange(part.first * 3, (part.first + part.count) * 3)
                if (part.part.isTranslucent || mode.seeThrough) {
                    translucent.add(tris to a)
                    continue
                }
                for (t in 0 until tris.size / 9) triangle(view, tris, t * 9, a, light, blend = false, depthBias = look.surfaceDepthOffset > 0f)
            }
            if (mode.showsRoofCover) {
                presentation.coverByObject[obj.id]?.let { cover ->
                    val a = mode.coverAppearance()
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
                        triangle(view, tri, 0, a, light, blend = false, depthBias = true, normal = n)
                    }
                }
            }
        }
        look.ground?.let { ground -> drawGround(view, footprint, ground, light) }

        // The translucent pass, in Filament's priority order: surfaces far to near, then the
        // feature edges, then the grid. Nothing translucent writes depth.
        val glassTris = ArrayList<Triple<Double, FloatArray, SurfaceAppearance>>()
        for ((tris, a) in translucent) for (t in 0 until tris.size / 9) {
            val c = Vec3((tris[t * 9] + tris[t * 9 + 3] + tris[t * 9 + 6]) / 3.0, (tris[t * 9 + 1] + tris[t * 9 + 4] + tris[t * 9 + 7]) / 3.0, (tris[t * 9 + 2] + tris[t * 9 + 5] + tris[t * 9 + 8]) / 3.0)
            glassTris.add(Triple(view.depthOf(c), tris.copyOfRange(t * 9, t * 9 + 9), a))
        }
        glassTris.sortByDescending { it.first }
        for ((_, tri, a) in glassTris) triangle(view, tri, 0, a, light, blend = true, depthBias = false)

        val tiers = mode.edgeTiers
        if (tiers.isNotEmpty()) {
            val drawn = presentation.edges.drawn(visible, tiers, null)
            val arrays = drawn.merged.map { presentation.edges.merged[it].positions } + drawn.perObject.map { presentation.edges.groups[it].positions }
            for (p in arrays) for (s in 0 until p.size / 6) line(view, p, s * 6, look.edgeInk)
        }

        drawGrid(view, footprint, look.grid)

        return resolve()
    }

    private fun drawGround(view: ViewTransform, f: GroundFootprint, rgb: FloatArray, light: Light) {
        val y = f.sheetY.toFloat()
        val x0 = f.minX.toFloat(); val x1 = f.maxX.toFloat(); val z0 = f.minZ.toFloat(); val z1 = f.maxZ.toFloat()
        val sheet = SurfaceAppearance(rgb[0], rgb[1], rgb[2], 1f, roughness = 1f, metallic = 0f)
        // The renderer's two triangles, wound to face up; pushed behind the grid like its polygon offset.
        triangle(view, floatArrayOf(x0, y, z0, x0, y, z1, x1, y, z0), 0, sheet, light, blend = false, depthBias = true, bias = 1.002f)
        triangle(view, floatArrayOf(x1, y, z0, x0, y, z1, x1, y, z1), 0, sheet, light, blend = false, depthBias = true, bias = 1.002f)
    }

    private fun drawGrid(view: ViewTransform, f: GroundFootprint, grid: FloatArray) {
        val y = f.gridY.toFloat()
        // As the line material receives it: blended source-over, the colour taken as given.
        var x = f.minX
        while (x <= f.maxX) { line(view, floatArrayOf(x.toFloat(), y, f.minZ.toFloat(), x.toFloat(), y, f.maxZ.toFloat()), 0, grid, thin = true); x += 1.0 }
        var z = f.minZ
        while (z <= f.maxZ) { line(view, floatArrayOf(f.minX.toFloat(), y, z.toFloat(), f.maxX.toFloat(), y, z.toFloat()), 0, grid, thin = true); z += 1.0 }
    }

    private fun triangle(
        view: ViewTransform,
        p: FloatArray,
        o: Int,
        a: SurfaceAppearance,
        light: Light,
        blend: Boolean,
        depthBias: Boolean,
        normal: Vec3? = null,
        bias: Float = 1.0005f,
    ) {
        val va = Vec3(p[o].toDouble(), p[o + 1].toDouble(), p[o + 2].toDouble())
        val vb = Vec3(p[o + 3].toDouble(), p[o + 4].toDouble(), p[o + 5].toDouble())
        val vc = Vec3(p[o + 6].toDouble(), p[o + 7].toDouble(), p[o + 8].toDouble())
        val n = normal ?: ((vb - va) cross (vc - va)).normalized()
        // Back faces: the technical material culls them; the translucent one is two-sided.
        val toEye = view.toEye(va)
        if (!blend && (n dot toEye) <= 0.0) return
        val facing = if ((n dot toEye) < 0.0) n * -1.0 else n
        val diffuse = max(0.0, facing dot light.towardsSun).toFloat()
        val up = facing.y.toFloat()
        val k = FloatArray(3) { c -> max(0f, light.skyConstant[c] + light.skyFromAbove[c] * up) + light.sun[c] * diffuse }
        // Filament adds the emissive after light, scaled by the surface's alpha.
        val glow = floatArrayOf(a.emissiveRed * a.alpha, a.emissiveGreen * a.alpha, a.emissiveBlue * a.alpha)
        val src = floatArrayOf(a.red * k[0] + glow[0], a.green * k[1] + glow[1], a.blue * k[2] + glow[2])
        val sa = view.project(va) ?: return
        val sb = view.project(vb) ?: return
        val sc = view.project(vc) ?: return
        val minX = max(0, floor(min(sa[0], min(sb[0], sc[0]))).toInt())
        val maxX = min(w - 1, floor(max(sa[0], max(sb[0], sc[0]))).toInt() + 1)
        val minY = max(0, floor(min(sa[1], min(sb[1], sc[1]))).toInt())
        val maxY = min(h - 1, floor(max(sa[1], max(sb[1], sc[1]))).toInt() + 1)
        val area = edge(sa, sb, sc[0], sc[1])
        if (abs(area) < 1e-12) return
        val zBias = if (depthBias) bias else 1f
        for (y in minY..maxY) for (x in minX..maxX) {
            val px = x + 0.5; val py = y + 0.5
            val w0 = edge(sb, sc, px, py) / area
            val w1 = edge(sc, sa, px, py) / area
            val w2 = edge(sa, sb, px, py) / area
            if (w0 < 0 || w1 < 0 || w2 < 0) continue
            // Depth is linear in screen space only as its reciprocal under a perspective projection.
            val z = (if (view.perspective) 1.0 / (w0 / sa[2] + w1 / sb[2] + w2 / sc[2]) else w0 * sa[2] + w1 * sb[2] + w2 * sc[2]).toFloat() * zBias
            val i = y * w + x
            if (z >= depth[i]) continue
            if (blend) {
                // Premultiplied source-over: rgb + (1 - alpha) * destination.
                color[i * 3] = src[0] + (1 - a.alpha) * color[i * 3]
                color[i * 3 + 1] = src[1] + (1 - a.alpha) * color[i * 3 + 1]
                color[i * 3 + 2] = src[2] + (1 - a.alpha) * color[i * 3 + 2]
            } else {
                depth[i] = z
                color[i * 3] = src[0]; color[i * 3 + 1] = src[1]; color[i * 3 + 2] = src[2]
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

    /**
     * The filmic curve (Narkowicz's fit of ACES) standing in for Filament's
     * default tone mapper, then sRGB.
     */
    private fun toSrgb(linear: Float): Int {
        val x = max(0f, linear)
        val c = ((x * (2.51f * x + 0.03f)) / (x * (2.43f * x + 0.59f) + 0.14f)).coerceIn(0f, 1f)
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

    private companion object {
        /**
         * The viewer's fixed camera exposure (f/16, 1/125 s, ISO 100) as
         * Filament applies it to light: 1 / (1.2 * 2^EV100), where
         * 2^EV100 = N² / t = 16² × 125.
         */
        val EXPOSURE: Float = (1.0 / (1.2 * 16.0 * 16.0 * 125.0)).toFloat()
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
