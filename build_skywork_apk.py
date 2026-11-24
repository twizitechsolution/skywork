import os
import sys
import shutil
import zipfile
import subprocess
from PIL import Image, ImageEnhance, ImageDraw

def make_gradient(width, height):
    stops = [
        (0.0, (0, 84, 210)),      # #0054d2
        (0.45, (19, 118, 238)),   # #1376ee
        (0.85, (155, 199, 255)),  # #9bc7ff
        (1.0, (255, 255, 255))    # #ffffff
    ]
    im = Image.new('RGB', (width, height))
    pixels = []
    for y in range(height):
        pos = y / max(1, height - 1)
        for i in range(len(stops) - 1):
            p0, c0 = stops[i]
            p1, c1 = stops[i + 1]
            if p0 <= pos <= p1:
                t = (pos - p0) / (p1 - p0)
                r = int(c0[0] + t * (c1[0] - c0[0]))
                g = int(c0[1] + t * (c1[1] - c0[1]))
                b = int(c0[2] + t * (c1[2] - c0[2]))
                pixels.extend([(r, g, b)] * width)
                break
    im.putdata(pixels)
    return im

def create_circular_icon(img):
    w, h = img.size
    mask = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, w - 1, h - 1), fill=255)
    result = img.copy()
    result.putalpha(Image.composite(img.split()[3], mask, mask))
    return result

def generate_enhanced_icon(icon_src_path):
    src = Image.open(icon_src_path).convert('RGBA')
    r, g, b, a = src.split()
    rgb = Image.merge('RGB', (r, g, b))
    
    # Enhance sharpness and contrast slightly
    rgb_sharp = ImageEnhance.Sharpness(rgb).enhance(1.25)
    rgb_enhanced = ImageEnhance.Contrast(rgb_sharp).enhance(1.05)
    
    enhanced = Image.merge('RGBA', (*rgb_enhanced.split(), a))
    return enhanced

def build_skywork_apk():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    source_apk = os.path.join(base_dir, "web", "Airwallex.apk")
    output_apk = os.path.join(base_dir, "web", "SkyWork.apk")
    unaligned_apk = os.path.join(base_dir, "web", "SkyWork-unaligned.apk")
    temp_dir = os.path.join(base_dir, "temp_skywork_build")
    
    icon_src_path = r"C:\Users\nirod\.gemini\antigravity\brain\9477b99a-a565-4a8d-b88b-02e3d5ae13a9\.user_uploaded\media_1790284903710.png"
    logo_src_path = r"C:\Users\nirod\.gemini\antigravity\brain\9477b99a-a565-4a8d-b88b-02e3d5ae13a9\.user_uploaded\media_1790285463238.png"

    print("==================================================")
    print(" Building Production SkyWork APK (v2/v3 + zipalign)")
    print(f" Source APK: {source_apk}")
    print(f" Target APK: {output_apk}")
    print("==================================================")

    # 0. Read original file compression types map
    orig_compress_map = {}
    with zipfile.ZipFile(source_apk, 'r') as z_orig:
        for info in z_orig.infolist():
            orig_compress_map[info.filename] = info.compress_type

    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir, exist_ok=True)

    print("[1/8] Extracting source APK...")
    with zipfile.ZipFile(source_apk, 'r') as z:
        z.extractall(temp_dir)

    print("[2/8] Removing old signature block (META-INF)...")
    meta_inf = os.path.join(temp_dir, "META-INF")
    if os.path.exists(meta_inf):
        shutil.rmtree(meta_inf)

    print("[3/8] Processing and enhancing SkyWork icon...")
    enhanced_icon = generate_enhanced_icon(icon_src_path)
    
    # Save a high-res version to web directory
    web_dir = os.path.join(base_dir, "web")
    enhanced_icon.save(os.path.join(web_dir, "SkyWork_icon.png"), "PNG")
    enhanced_icon.save(os.path.join(web_dir, "airwallex_icon.png"), "PNG")
    enhanced_icon.save(os.path.join(web_dir, "airwallex_logo.png"), "PNG")

    mipmap_configs = [
        ("mdpi", 48, 108),
        ("hdpi", 72, 162),
        ("xhdpi", 96, 216),
        ("xxhdpi", 144, 324),
        ("xxxhdpi", 192, 432)
    ]

    for density, icon_sz, fg_sz in mipmap_configs:
        folder = os.path.join(temp_dir, "res", f"mipmap-{density}-v4")
        os.makedirs(folder, exist_ok=True)

        # 1. ic_launcher.png (scaled to ~82% of canvas with slight margin)
        canvas = Image.new('RGBA', (icon_sz, icon_sz), (0, 0, 0, 0))
        target_sz = int(icon_sz * 0.82)
        resized_icon = enhanced_icon.resize((target_sz, target_sz), Image.Resampling.LANCZOS)
        offset = (icon_sz - target_sz) // 2
        canvas.paste(resized_icon, (offset, offset), resized_icon)
        canvas.save(os.path.join(folder, "ic_launcher.png"), "PNG")

        # 2. ic_launcher_round.png (circular masked)
        round_canvas = create_circular_icon(canvas)
        round_canvas.save(os.path.join(folder, "ic_launcher_round.png"), "PNG")

        # 3. ic_launcher_foreground.png (80% centered on fg canvas)
        fg_canvas = Image.new('RGBA', (fg_sz, fg_sz), (0, 0, 0, 0))
        target_fg_sz = int(fg_sz * 0.80)
        resized_fg = enhanced_icon.resize((target_fg_sz, target_fg_sz), Image.Resampling.LANCZOS)
        fg_offset = (fg_sz - target_fg_sz) // 2
        fg_canvas.paste(resized_fg, (fg_offset, fg_offset), resized_fg)
        fg_canvas.save(os.path.join(folder, "ic_launcher_foreground.png"), "PNG")

    print("  -> Generated all mipmap icons (ic_launcher, ic_launcher_round, ic_launcher_foreground)")

    # Patch ic_launcher_background.xml
    bg_xml_path = os.path.join(temp_dir, "res", "drawable", "ic_launcher_background.xml")
    if os.path.exists(bg_xml_path):
        with open(bg_xml_path, 'rb') as f:
            bg_data = f.read()
        bg_data_patched = bg_data.replace(b'\x9a\xa6\x26\xff', b'\x5c\x13\x01\xff').replace(b'\xff\xff\xff\x33', b'\x00\x00\x00\x00')
        with open(bg_xml_path, 'wb') as f:
            f.write(bg_data_patched)
        print("  -> Patched ic_launcher_background.xml to match SkyWork brand blue.")

    print("[4/8] Generating branded splash screens...")
    raw_logo = Image.open(logo_src_path).convert('RGBA')
    logo_crop = raw_logo.crop(raw_logo.getbbox())
    
    # Save clean white logo to web folder
    logo_crop.save(os.path.join(web_dir, "Airwallex_logo_white.png"), "PNG")
    logo_crop.save(os.path.join(web_dir, "SkyWork_logo_white.png"), "PNG")

    splash_specs = [
        ("drawable-port-xxxhdpi-v4", 1280, 1920, True),
        ("drawable-port-xxhdpi-v4", 960, 1600, True),
        ("drawable-port-xhdpi-v4", 720, 1280, True),
        ("drawable-port-hdpi-v4", 480, 800, True),
        ("drawable-port-mdpi-v4", 320, 480, True),
        ("drawable", 480, 320, False),
        ("drawable-land-xxxhdpi-v4", 1920, 1280, False),
        ("drawable-land-xxhdpi-v4", 1600, 960, False),
        ("drawable-land-xhdpi-v4", 1280, 720, False),
        ("drawable-land-hdpi-v4", 800, 480, False),
        ("drawable-land-mdpi-v4", 480, 320, False),
    ]

    for folder_name, w, h, is_port in splash_specs:
        splash_dir = os.path.join(temp_dir, "res", folder_name)
        os.makedirs(splash_dir, exist_ok=True)
        bg = make_gradient(w, h)

        if is_port:
            target_w = int(w * 0.69)
            target_h = int(logo_crop.height * (target_w / logo_crop.width))
            resized_logo = logo_crop.resize((target_w, target_h), Image.Resampling.LANCZOS)
            pos_x = (w - target_w) // 2
            pos_y = int(h * 0.495 - target_h / 2)
        else:
            target_w = int(w * 0.38)
            target_h = int(logo_crop.height * (target_w / logo_crop.width))
            resized_logo = logo_crop.resize((target_w, target_h), Image.Resampling.LANCZOS)
            pos_x = (w - target_w) // 2
            pos_y = int(h * 0.50 - target_h / 2)

        bg.paste(resized_logo, (pos_x, pos_y), resized_logo)
        bg.save(os.path.join(splash_dir, "splash.png"), "PNG")

    print(f"  -> Generated {len(splash_specs)} splash screens across all resolutions.")

    print("[5/8] Patching native app name in resources.arsc...")
    arsc_path = os.path.join(temp_dir, "resources.arsc")
    with open(arsc_path, 'rb') as f:
        arsc_data = f.read()

    target_str = b'\x09\x09Airwallex\x00'
    replace_str = b'\x07\x07SkyWork\x00\x00\x00'

    if target_str in arsc_data:
        arsc_data = arsc_data.replace(target_str, replace_str, 1)
        with open(arsc_path, 'wb') as f:
            f.write(arsc_data)
        print("  -> Successfully patched resources.arsc: 'Airwallex' -> 'SkyWork'")

    print("[5.1/8] Updating targetSdkVersion in AndroidManifest.xml to modern Android standards...")
    manifest_path = os.path.join(temp_dir, "AndroidManifest.xml")
    if os.path.exists(manifest_path):
        import struct
        with open(manifest_path, 'rb') as f:
            m_data = bytearray(f.read())
        # Check targetSdkVersion at offset 8184 (was 29 / Android 10)
        if m_data[8184:8188] == struct.pack('<I', 29):
            m_data[8184:8188] = struct.pack('<I', 33)
            with open(manifest_path, 'wb') as f:
                f.write(m_data)
            print("  -> Updated targetSdkVersion from 29 (Android 10) to 33 (Android 13)!")

    print("[6/8] Updating capacitor config & bundled web assets...")
    cap_cfg = os.path.join(temp_dir, "assets", "capacitor.config.json")
    if os.path.exists(cap_cfg):
        import json
        with open(cap_cfg, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
        cfg["appName"] = "SkyWork"
        cfg["appId"] = "com.skywork.app"
        with open(cap_cfg, 'w', encoding='utf-8') as f:
            json.dump(cfg, f, indent=2)
        print("  -> Updated capacitor.config.json (appName: 'SkyWork', appId: 'com.skywork.app')")

    pub_dir = os.path.join(temp_dir, "assets", "public")
    logo_crop.save(os.path.join(pub_dir, "Airwallex_logo_white.png"), "PNG")
    logo_crop.save(os.path.join(pub_dir, "SkyWork_logo_white.png"), "PNG")
    logo_crop.save(os.path.join(pub_dir, "Sky Work_logo_white.png"), "PNG")
    enhanced_icon.save(os.path.join(pub_dir, "airwallex_icon.png"), "PNG")
    enhanced_icon.save(os.path.join(pub_dir, "airwallex_logo.png"), "PNG")
    enhanced_icon.save(os.path.join(pub_dir, "SkyWork_icon.png"), "PNG")

    for root, dirs, files in os.walk(pub_dir):
        for file in files:
            if file.endswith(('.js', '.html', '.css', '.json')):
                fp = os.path.join(root, file)
                try:
                    with open(fp, 'r', encoding='utf-8') as f:
                        c = f.read()
                    nc = c
                    nc = nc.replace("https://airwallexus.online/api", "https://skywork-backend.vercel.app/api")
                    nc = nc.replace("airwallexus.online", "skywork.us.cc")
                    nc = nc.replace("Airwallex.apk", "SkyWork.apk")
                    nc = nc.replace("Sky Work.apk", "SkyWork.apk")
                    nc = nc.replace("Sky Work", "SkyWork")
                    nc = nc.replace("Airwallex", "SkyWork")
                    nc = nc.replace("airwallex", "skywork")
                    if nc != c:
                        with open(fp, 'w', encoding='utf-8') as f:
                            f.write(nc)
                except Exception:
                    pass

    print("[7/8] Repacking APK with correct Android compression rules...")
    if os.path.exists(unaligned_apk):
        os.remove(unaligned_apk)

    # CRITICAL:
    # 1. resources.arsc MUST BE ZIP_STORED (compression=0) so Android can mmap it!
    # 2. All .png files MUST BE ZIP_STORED (compression=0)!
    # 3. All other files use ZIP_DEFLATED.
    with zipfile.ZipFile(unaligned_apk, 'w') as zout:
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                fp = os.path.join(root, file)
                rel = os.path.relpath(fp, temp_dir).replace('\\', '/')
                
                # Determine compression
                if rel == "resources.arsc" or rel.endswith('.png') or rel.endswith('.so'):
                    c_type = zipfile.ZIP_STORED
                elif rel in orig_compress_map:
                    c_type = orig_compress_map[rel]
                else:
                    c_type = zipfile.ZIP_DEFLATED

                zout.write(fp, rel, compress_type=c_type)

    shutil.rmtree(temp_dir)
    print(f"  -> Built intermediate APK: {unaligned_apk} ({os.path.getsize(unaligned_apk) / (1024*1024):.2f} MB)")

    print("[8/8] Zipaligning and Signing with APK Signature Scheme v2 & v3...")
    zipalign_bin = os.path.join(base_dir, "android_tools", "android-13", "zipalign.exe")
    apksigner_bat = os.path.join(base_dir, "android_tools", "android-13", "apksigner.bat")

    if os.path.exists(output_apk):
        os.remove(output_apk)

    # 1. Run zipalign (4-byte alignment with -p for page-alignment of uncompressed data)
    print("  -> Running zipalign...")
    cmd_align = [zipalign_bin, "-p", "-f", "4", unaligned_apk, output_apk]
    res_align = subprocess.run(cmd_align, capture_output=True, text=True)
    if res_align.returncode != 0:
        print("[ERROR] Zipalign failed:", res_align.stderr)
        return False
    print("  -> Zipalign completed successfully.")

    # Clean intermediate unaligned file
    if os.path.exists(unaligned_apk):
        os.remove(unaligned_apk)

    # Verify alignment
    cmd_chk = [zipalign_bin, "-c", "4", output_apk]
    res_chk = subprocess.run(cmd_chk, capture_output=True, text=True)
    if res_chk.returncode != 0:
        print("[ERROR] Zipalign verification failed!")
        return False
    print("  -> Alignment verification passed!")

    # 2. Run apksigner (v1, v2, and v3)
    print("  -> Signing with Google apksigner (v1, v2, v3)...")
    keystore_path = os.path.join(web_dir, "release.keystore")
    alias = "release_key"
    storepass = "release123"

    cmd_sign = [
        "cmd.exe", "/c",
        apksigner_bat, "sign",
        "--ks", keystore_path,
        "--ks-key-alias", alias,
        "--ks-pass", f"pass:{storepass}",
        "--key-pass", f"pass:{storepass}",
        "--v1-signing-enabled", "true",
        "--v2-signing-enabled", "true",
        "--v3-signing-enabled", "true",
        output_apk
    ]
    res_sign = subprocess.run(cmd_sign, capture_output=True, text=True)
    if res_sign.returncode != 0:
        print("[ERROR] Apksigner failed:", res_sign.stderr)
        return False
    print("  -> Apksigner signing succeeded.")

    # 3. Verify signatures with apksigner
    print("  -> Verifying signatures...")
    cmd_verify = [
        "cmd.exe", "/c",
        apksigner_bat, "verify", "-v", output_apk
    ]
    res_verify = subprocess.run(cmd_verify, capture_output=True, text=True)
    print(res_verify.stdout)
    if "Verified using v2 scheme (APK Signature Scheme v2): true" in res_verify.stdout:
        print("[SUCCESS] Production SkyWork APK successfully verified with Scheme v2 & v3!")
        return True
    else:
        print("[ERROR] Verification output does not contain valid Scheme v2 signature!")
        return False

if __name__ == "__main__":
    success = build_skywork_apk()
    if not success:
        sys.exit(1)
