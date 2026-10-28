"""Check every 64-bit ELF load segment in an APK/AAB using only Python stdlib."""
import struct
import sys
import zipfile


def check(archive):
    checked = 0
    failures = []
    with zipfile.ZipFile(archive) as bundle:
        for name in bundle.namelist():
            if not name.endswith('.so') or not any('/' + abi + '/' in name for abi in ('arm64-v8a', 'x86_64')):
                continue
            data = bundle.read(name)
            if data[:6] != b'\x7fELF\x02\x01':
                failures.append(f'{name}: unsupported ELF header')
                continue
            checked += 1
            offset = struct.unpack_from('<Q', data, 32)[0]
            size, count = struct.unpack_from('<HH', data, 54)
            for index in range(count):
                header = offset + size * index
                kind = struct.unpack_from('<I', data, header)[0]
                alignment = struct.unpack_from('<Q', data, header + 48)[0]
                if kind == 1 and alignment < 16384:
                    failures.append(f'{name}: LOAD alignment {alignment} is below 16 KB')
    if not checked:
        failures.append('No 64-bit native libraries found; check the artifact path/architectures.')
    if failures:
        raise SystemExit('\n'.join(failures))
    print(f'16 KB ELF alignment passed for {checked} native libraries in {archive}')


if __name__ == '__main__':
    check(sys.argv[1])
