import json, subprocess, sys, numpy as np
from PIL import Image
name, target = sys.argv[1], float(sys.argv[2]); mid = float(sys.argv[3]) if len(sys.argv) > 3 else target / 2
f = f"/tmp/browser/film/out/{name}.webm"
pr = json.loads(subprocess.check_output(["ffprobe","-v","error","-show_streams","-show_format","-of","json",f]))
v = [s for s in pr["streams"] if s["codec_type"]=="video"][0]; a = [s for s in pr["streams"] if s["codec_type"]=="audio"][0]
dur = float(pr["format"]["duration"]); br = int(pr["format"]["bit_rate"])
pcm = np.frombuffer(subprocess.check_output(["ffmpeg","-v","error","-i",f,"-f","f32le","-ac","1","-ar","8000","-"]), dtype=np.float32)
rms = [float(np.sqrt(np.mean(pcm[i:i+4000]**2))) for i in range(0, len(pcm), 4000)]
raw = subprocess.check_output(["ffmpeg","-v","error","-i",f,"-vf","fps=2,scale=480:270","-f","rawvideo","-pix_fmt","gray","-"])
fr = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 270, 480).astype(np.float32)
diff = [round(float(np.mean(np.abs(fr[i+1]-fr[i]))),2) for i in range(len(fr)-1)]
subprocess.check_call(["ffmpeg","-v","error","-y","-ss",str(mid),"-i",f,"-frames:v","1",f"/tmp/browser/film/out/{name}-mid.png"])
Image.open(f"/tmp/browser/film/out/{name}-mid.png").convert("RGB").save(f"/tmp/browser/film/out/{name}.jpg", quality=85)
ok = abs(dur-target) <= 1 and v["width"]==1920 and v["height"]==1080 and max(rms) > 0.01 and br >= 12_000_000
print(json.dumps({"name":name,"ok":ok,"dur":dur,"size":f'{v["width"]}x{v["height"]}',"vcodec":v["codec_name"],"fps":v["r_frame_rate"],"acodec":a["codec_name"],"ach":a.get("channels"),"mbps":round(br/1e6,2),"rms_half_s":[round(x,3) for x in rms],"framediff_half_s":diff}))
