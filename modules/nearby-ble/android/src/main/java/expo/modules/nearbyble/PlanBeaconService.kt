package expo.modules.nearbyble

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper

/**
 * Shares one plan over Bluetooth while the host's phone is in their pocket.
 * Runs as a foreground service with a "Sharing your plan nearby" notification
 * and a Stop button. Broadcasts the code for the current 10-minute window and
 * stops by itself when sharing ends.
 */
class PlanBeaconService : Service() {
  companion object {
    @Volatile
    var activePostId: String? = null

    private const val CHANNEL_ID = "nearry_sharing"
    private const val NOTIFICATION_ID = 4107
    private const val ACTION_STOP = "expo.modules.nearbyble.STOP_SHARING"

    fun start(context: Context, postId: String, title: String, codes: List<BeaconCode>, endsMs: Long) {
      val intent = Intent(context, PlanBeaconService::class.java).apply {
        putExtra("postId", postId)
        putExtra("title", title)
        putExtra("codes", codes.map { it.code }.toTypedArray())
        putExtra("from", codes.map { it.fromMs.toLong() }.toLongArray())
        putExtra("until", codes.map { it.untilMs.toLong() }.toLongArray())
        putExtra("endsMs", endsMs)
      }
      // Set now, not when the service starts a moment later, so the plan page
      // doesn't read "not sharing" in between and stop it.
      activePostId = postId
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
        else context.startService(intent)
      } catch (e: Exception) {
        activePostId = null
        throw e
      }
    }

    fun stop(context: Context) {
      activePostId = null
      context.stopService(Intent(context, PlanBeaconService::class.java))
    }
  }

  private val handler = Handler(Looper.getMainLooper())
  private var advertiser: BluetoothLeAdvertiser? = null
  private var callback: AdvertiseCallback? = null
  private var codes: Array<String> = emptyArray()
  private var from: LongArray = LongArray(0)
  private var until: LongArray = LongArray(0)
  private var endsMs: Long = 0

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent == null || intent.action == ACTION_STOP) {
      stopEverything()
      return START_NOT_STICKY
    }
    val title = intent.getStringExtra("title") ?: "Your plan"
    if (!startInForeground(title)) {
      activePostId = null
      return START_NOT_STICKY
    }
    codes = intent.getStringArrayExtra("codes") ?: emptyArray()
    from = intent.getLongArrayExtra("from") ?: LongArray(0)
    until = intent.getLongArrayExtra("until") ?: LongArray(0)
    endsMs = intent.getLongExtra("endsMs", 0)
    activePostId = intent.getStringExtra("postId")
    handler.removeCallbacksAndMessages(null)
    advertiseCurrent()
    return START_NOT_STICKY
  }

  private fun advertiseCurrent() {
    val now = System.currentTimeMillis()
    if (now >= endsMs || codes.isEmpty()) {
      stopEverything()
      return
    }
    val index = codes.indices.firstOrNull { from[it] <= now && now < until[it] }
    if (index == null) {
      val next = codes.indices.map { from[it] }.filter { it > now }.minOrNull()
      stopAdvertising()
      if (next == null) stopEverything() else handler.postDelayed({ advertiseCurrent() }, next - now)
      return
    }
    stopAdvertising()
    startAdvertising(codes[index])
    val nextChange = minOf(until[index], endsMs)
    handler.postDelayed({ advertiseCurrent() }, maxOf(1000L, nextChange - now))
  }

  private fun startAdvertising(code: String) {
    val payload = BeaconPayload.encode(code) ?: return
    val adv = getSystemService(BluetoothManager::class.java)?.adapter?.bluetoothLeAdvertiser
    if (adv == null) {
      stopEverything()
      return
    }
    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
      .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
      .setConnectable(false)
      .setTimeout(0)
      .build()
    val data = AdvertiseData.Builder()
      .setIncludeDeviceName(false)
      .setIncludeTxPowerLevel(false)
      .addManufacturerData(BeaconPayload.MANUFACTURER_ID, payload)
      .build()
    val cb = object : AdvertiseCallback() {}
    try {
      adv.startAdvertising(settings, data, cb)
      advertiser = adv
      callback = cb
    } catch (_: SecurityException) {
      stopEverything()
    }
  }

  private fun stopAdvertising() {
    val adv = advertiser
    val cb = callback
    advertiser = null
    callback = null
    if (adv != null && cb != null) {
      try {
        adv.stopAdvertising(cb)
      } catch (_: Exception) {
      }
    }
  }

  private fun startInForeground(title: String): Boolean {
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager?.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Sharing plans nearby", NotificationManager.IMPORTANCE_LOW)
      )
    }
    val immutable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
    val stopIntent = PendingIntent.getService(
      this, 0, Intent(this, PlanBeaconService::class.java).setAction(ACTION_STOP),
      immutable or PendingIntent.FLAG_UPDATE_CURRENT
    )
    val openIntent = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 1, it, immutable or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val icon = resources.getIdentifier("notification_icon", "drawable", packageName)
      .takeIf { it != 0 } ?: applicationInfo.icon
    @Suppress("DEPRECATION")
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL_ID)
    else Notification.Builder(this)
    val notification = builder
      .setSmallIcon(icon)
      .setContentTitle("Sharing your plan nearby")
      .setContentText(title)
      .setOngoing(true)
      .setContentIntent(openIntent)
      .addAction(Notification.Action.Builder(null as Icon?, "Stop", stopIntent).build())
      .build()
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
      true
    } catch (_: Exception) {
      stopSelf()
      false
    }
  }

  private fun stopEverything() {
    handler.removeCallbacksAndMessages(null)
    stopAdvertising()
    activePostId = null
    @Suppress("DEPRECATION")
    stopForeground(true)
    stopSelf()
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    stopAdvertising()
    activePostId = null
    super.onDestroy()
  }
}
