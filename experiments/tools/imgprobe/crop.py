import sys, zlib, struct
from png import load, rgba_getter

def write_png(path, w, h, getpx):
    raw=bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            r,g,b,a = getpx(x,y); raw += bytes((r,g,b,a))
    def chunk(t,d):
        c=t+d
        return struct.pack('>I',len(d))+c+struct.pack('>I', zlib.crc32(c)&0xffffffff)
    out=b'\x89PNG\r\n\x1a\n'
    out+=chunk(b'IHDR', struct.pack('>IIBBBBB', w,h,8,6,0,0,0))
    out+=chunk(b'IDAT', zlib.compress(bytes(raw),6))
    out+=chunk(b'IEND', b'')
    open(path,'wb').write(out)

src, dst, x0,y0,x1,y1, zoom = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:8])
w,h,ch,ct,plte,trns,px = load(src)
get = rgba_getter(w,h,ch,ct,plte,trns,px)
cw, chh = (x1-x0)*zoom, (y1-y0)*zoom
write_png(dst, cw, chh, lambda x,y: get(min(w-1,x0+x//zoom), min(h-1,y0+y//zoom)))
print(f'{dst} {cw}x{chh}')
