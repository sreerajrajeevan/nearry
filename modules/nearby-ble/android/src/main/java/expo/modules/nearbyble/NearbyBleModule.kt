package expo.modules.nearbyble

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.util.concurrent.atomic.AtomicBoolean

class BeaconCode : Record {
  @Field val code: String = ""
  @Field val fromMs: Double = 0.0
  @Field val untilMs: Double = 0.0
}

class NearbyBleModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun adapter(): BluetoothAdapter? =
    context.getSystemService(BluetoothManager::class.java)?.adapter

  override fun definition() = ModuleDefinition {
    Name("NearbyBle")

    Function("isSupported") {
      adapter() != null && context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)
    }

    Function("isBluetoothOn") { adapter()?.isEnabled == true }

    Function("sharingPostId") { PlanBeaconService.activePostId }

    Function("stopSharing") { PlanBeaconService.stop(context) }

    AsyncFunction("startSharing") { postId: String, title: String, codes: List<BeaconCode>, endsMs: Double, promise: Promise ->
      val bt = adapter()
      if (bt == null || !bt.isEnabled) {
        promise.reject("BLUETOOTH_OFF", "Bluetooth is off", null)
        return@AsyncFunction
      }
      if (bt.bluetoothLeAdvertiser == null) {
        promise.reject("NO_ADVERTISING", "This phone can't share over Bluetooth", null)
        return@AsyncFunction
      }
      val valid = codes.filter { BeaconPayload.encode(it.code) != null }
      if (valid.isEmpty()) {
        promise.reject("NO_CODES", "Nothing to share", null)
        return@AsyncFunction
      }
      try {
        PlanBeaconService.start(context, postId, title, valid, endsMs.toLong())
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("START_FAILED", e.message ?: "Couldn't start sharing", e)
      }
    }

    AsyncFunction("scan") { durationMs: Int, promise: Promise ->
      scan(durationMs, promise)
    }
  }

  private fun scan(durationMs: Int, promise: Promise) {
    val bt = adapter()
    if (bt == null || !bt.isEnabled) {
      promise.reject("BLUETOOTH_OFF", "Bluetooth is off", null)
      return
    }
    val scanner = bt.bluetoothLeScanner
    if (scanner == null) {
      promise.reject("BLUETOOTH_OFF", "Bluetooth is off", null)
      return
    }
    val found = HashMap<String, Int>()
    val done = AtomicBoolean(false)
    val callback = object : ScanCallback() {
      private fun record(result: ScanResult) {
        val code = BeaconPayload.decode(
          result.scanRecord?.getManufacturerSpecificData(BeaconPayload.MANUFACTURER_ID)
        ) ?: return
        synchronized(found) {
          val best = found[code]
          if (best == null || result.rssi > best) found[code] = result.rssi
        }
      }

      override fun onScanResult(callbackType: Int, result: ScanResult) = record(result)

      override fun onBatchScanResults(results: MutableList<ScanResult>) {
        results.forEach { record(it) }
      }

      override fun onScanFailed(errorCode: Int) {
        if (done.compareAndSet(false, true)) {
          promise.reject("SCAN_FAILED", "Bluetooth scan failed ($errorCode)", null)
        }
      }
    }
    val filter = ScanFilter.Builder()
      .setManufacturerData(BeaconPayload.MANUFACTURER_ID, BeaconPayload.MAGIC, BeaconPayload.MAGIC_MASK)
      .build()
    val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
    try {
      scanner.startScan(listOf(filter), settings, callback)
    } catch (e: SecurityException) {
      promise.reject("PERMISSION", "Nearby devices permission is needed", e)
      return
    }
    Handler(Looper.getMainLooper()).postDelayed({
      try {
        scanner.stopScan(callback)
      } catch (_: Exception) {
      }
      if (done.compareAndSet(false, true)) {
        val list = synchronized(found) { found.map { mapOf("code" to it.key, "rssi" to it.value) } }
        promise.resolve(list)
      }
    }, durationMs.toLong().coerceIn(1000L, 30000L))
  }
}
