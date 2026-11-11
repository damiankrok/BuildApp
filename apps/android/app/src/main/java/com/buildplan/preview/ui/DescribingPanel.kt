package com.buildplan.preview.ui

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.buildplan.preview.R
import com.buildplan.preview.analyzer.DescribedPicture
import com.buildplan.preview.analyzer.DescribedPictureLoader
import com.buildplan.preview.analyzer.DescribingWords
import com.buildplan.preview.analyzer.JobDescribing
import com.buildplan.preview.analyzer.PictureFetch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * v3.53.2: what the service is doing while it reads the house as a whole from the page's pictures — the phase, why it
 * started, and the pictures actually being interpreted. Each picture shown is the ORIGINAL from the page, and only when
 * the bytes this phone downloaded hash to the SHA-256 the service named; what was sent to the reader (a smaller JPEG)
 * is said in words with its own size. Nothing is drawn on a picture: the reader returns a description of the house,
 * not positions, so there is nothing truthful to mark.
 */
@Composable
internal fun DescribingPanel(describing: JobDescribing, loader: DescribedPictureLoader?) {
    Column(
        Modifier.fillMaxWidth().background(Palette.Raised, RoundedCornerShape(Radius.panel)).padding(Space.m),
        verticalArrangement = Arrangement.spacedBy(Space.xs),
    ) {
        Text(
            stringResource(R.string.describing_title),
            style = MaterialTheme.typography.titleSmall,
            color = Palette.Ink,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            DescribingWords.phase(describing),
            style = MaterialTheme.typography.bodyMedium,
            color = Palette.Ink,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        )
        DescribingWords.reason(describing.after)?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted) }
        if (describing.pictures.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Space.s)) {
                describing.pictures.forEach { DescribedThumb(it, loader) }
            }
            Text(stringResource(R.string.describing_pictures_note), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted)
        }
    }
}

private sealed interface Thumb {
    data object Loading : Thumb
    class Shown(val image: ImageBitmap) : Thumb
    data class Words(val text: Int) : Thumb
}

@Composable
private fun DescribedThumb(picture: DescribedPicture, loader: DescribedPictureLoader?) {
    // keyed by the original's hash: the same picture is fetched once, whichever poll carried it
    val state by produceState<Thumb>(Thumb.Loading, picture.original.sha256, picture.original.url) {
        value = if (loader == null) Thumb.Words(R.string.describing_picture_unverifiable) else withContext(Dispatchers.IO) {
            when (val fetched = loader.fetch(picture)) {
                is PictureFetch.Verified -> decode(fetched.bytes)?.let { Thumb.Shown(it) } ?: Thumb.Words(R.string.describing_picture_unreadable)
                PictureFetch.HashMismatch -> Thumb.Words(R.string.describing_picture_mismatch)
                PictureFetch.NotVerifiable -> Thumb.Words(R.string.describing_picture_unverifiable)
                is PictureFetch.Unavailable -> Thumb.Words(R.string.describing_picture_unavailable)
            }
        }
    }
    Column(Modifier.width(132.dp), verticalArrangement = Arrangement.spacedBy(Space.xs)) {
        Box(Modifier.width(132.dp).height(96.dp).clip(RoundedCornerShape(Radius.panel)).background(Palette.Hairline), contentAlignment = Alignment.Center) {
            when (val s = state) {
                Thumb.Loading -> Text(stringResource(R.string.describing_picture_loading), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted)
                is Thumb.Shown -> Image(s.image, contentDescription = null, contentScale = ContentScale.Fit, modifier = Modifier.width(132.dp).height(96.dp))
                is Thumb.Words -> Text(stringResource(s.text), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, modifier = Modifier.padding(Space.xs))
            }
        }
        Text(
            stringResource(R.string.describing_picture_caption, picture.number, DescribingWords.kind(picture.kind)),
            style = MaterialTheme.typography.bodySmall,
            color = Palette.Ink,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            stringResource(R.string.describing_picture_sent, picture.sent.widthPx, picture.sent.heightPx),
            style = MaterialTheme.typography.bodySmall,
            color = Palette.InkMuted,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** A thumbnail-sized decode: the phone never holds a publisher's full-size picture in memory for a 132 dp tile. */
private fun decode(bytes: ByteArray): ImageBitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    var sample = 1
    while (bounds.outWidth / (sample * 2) >= 400 || bounds.outHeight / (sample * 2) >= 400) sample *= 2
    return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })?.asImageBitmap()
}
