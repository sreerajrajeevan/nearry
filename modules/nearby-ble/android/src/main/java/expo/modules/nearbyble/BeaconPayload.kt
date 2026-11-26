package expo.modules.nearbyble

/**
 * What a Nearry phone broadcasts: manufacturer data under the Bluetooth
 * test company id 0xFFFF, starting with "NRY" and followed by the 8-byte
 * plan code (16 hex characters). The code says nothing by itself; only the
 * Nearry server can turn it back into a plan.
 */
object BeaconPayload {
  const val MANUFACTURER_ID = 0xFFFF
  val MAGIC = byteArrayOf(0x4E, 0x52, 0x59)
  val MAGIC_MASK = byteArrayOf(-1, -1, -1)
  private const val CODE_BYTES = 8

  fun encode(code: String): ByteArray? {
    if (!Regex("^[0-9a-f]{16}$").matches(code)) return null
    val bytes = ByteArray(CODE_BYTES) { i -> code.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
    return MAGIC + bytes
  }

  fun decode(data: ByteArray?): String? {
    if (data == null || data.size < MAGIC.size + CODE_BYTES) return null
    for (i in MAGIC.indices) if (data[i] != MAGIC[i]) return null
    return (MAGIC.size until MAGIC.size + CODE_BYTES).joinToString("") { i ->
      String.format("%02x", data[i].toInt() and 0xff)
    }
  }
}
