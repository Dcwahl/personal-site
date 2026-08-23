import zlib, struct

def load(path):
    data = open(path,'rb').read()
    assert data[:8]==b'\x89PNG\r\n\x1a\n'
    pos=8; idat=b''; w=h=bd=ct=None; plte=None; trns=None
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+ln]
        if typ==b'IHDR':
            w,h,bd,ct,comp,filt,inter = struct.unpack('>IIBBBBB', chunk)
            assert inter==0, 'interlaced not supported'
        elif typ==b'IDAT': idat+=chunk
        elif typ==b'PLTE': plte=chunk
        elif typ==b'tRNS': trns=chunk
        elif typ==b'IEND': break
        pos += 12+ln
    raw = zlib.decompress(idat)
    ch = {0:1,2:3,3:1,4:2,6:4}[ct]
    assert bd==8, f'bitdepth {bd}'
    bpp = ch
    stride = w*bpp
    out = bytearray(h*stride)
    prev = bytearray(stride)
    p=0
    for y in range(h):
        f = raw[p]; p+=1
        line = bytearray(raw[p:p+stride]); p+=stride
        if f==1:
            for i in range(bpp, stride): line[i] = (line[i]+line[i-bpp])&255
        elif f==2:
            for i in range(stride): line[i] = (line[i]+prev[i])&255
        elif f==3:
            for i in range(stride):
                a = line[i-bpp] if i>=bpp else 0
                line[i] = (line[i]+((a+prev[i])>>1))&255
        elif f==4:
            for i in range(stride):
                a = line[i-bpp] if i>=bpp else 0
                c = prev[i-bpp] if i>=bpp else 0
                b = prev[i]
                pa=abs(b-c); pb=abs(a-c); pc=abs(a+b-2*c)
                pr = a if (pa<=pb and pa<=pc) else (b if pb<=pc else c)
                line[i]=(line[i]+pr)&255
        out[y*stride:(y+1)*stride]=line
        prev=line
    return w,h,ch,ct,plte,trns,bytes(out)

def rgba_getter(w,h,ch,ct,plte,trns,px):
    def get(x,y):
        i=(y*w+x)*ch
        if ct==6: return px[i],px[i+1],px[i+2],px[i+3]
        if ct==2: return px[i],px[i+1],px[i+2],255
        if ct==0: v=px[i]; return v,v,v,255
        if ct==4: v=px[i]; return v,v,v,px[i+1]
        if ct==3:
            idx=px[i]; r,g,b = plte[idx*3],plte[idx*3+1],plte[idx*3+2]
            a = trns[idx] if trns and idx<len(trns) else 255
            return r,g,b,a
    return get
