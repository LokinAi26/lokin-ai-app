package com.lokin.vision.xr

import android.graphics.Color as AndroidColor
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.xr.glimmer.GlimmerTheme
import androidx.xr.glimmer.Text
import androidx.xr.glimmer.googlefonts.createGoogleSansFlexTypography
import androidx.xr.projected.experimental.ExperimentalProjectedApi

@OptIn(ExperimentalProjectedApi::class)
class ProjectedMainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Additive display rule: black pixels remain transparent on display glasses.
        window.setBackgroundDrawable(ColorDrawable(AndroidColor.BLACK))
        LokinVisionXrState.update(true, "projected_active")

        setContent {
            val typography = createGoogleSansFlexTypography()
            GlimmerTheme(typography = typography) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black)
                        .padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "LOKIN Vision XR ready",
                        style = GlimmerTheme.typography.titleLarge
                    )
                    Text(
                        text = "Legacy Deck bridge connected",
                        modifier = Modifier.padding(top = 10.dp),
                        style = GlimmerTheme.typography.bodyMedium
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        LokinVisionXrState.update(true, "projected_active")
    }

    override fun onPause() {
        LokinVisionXrState.update(true, "projected_background")
        super.onPause()
    }

    override fun onDestroy() {
        LokinVisionXrState.update(false, "waiting_device")
        super.onDestroy()
    }
}
