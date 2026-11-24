import os
import sys
import shutil
import zipfile
import subprocess

def rebrand_apk(
    source_apk,
    output_apk,
    new_app_name,
    new_domain,
    new_package_id="com.app.platform"
):
    print("==================================================")
    print(f" Rebranding Native Capacitor APK")
    print(f" Source APK:    {source_apk}")
    print(f" Target APK:    {output_apk}")
    print(f" New App Name:  {new_app_name}")
    print(f" New Domain:    {new_domain}")
    print(f" Package ID:    {new_package_id}")
    print("==================================================")

    if not os.path.exists(source_apk):
        print(f"ERROR: Source APK not found: {source_apk}")
        return False

    temp_dir = os.path.join(os.path.dirname(output_apk), "temp_apk_build")
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir, exist_ok=True)

    print("[1/5] Extracting native APK assets...")
    with zipfile.ZipFile(source_apk, 'r') as z:
        z.extractall(temp_dir)

    # 1. Remove old APK signatures
    meta_inf = os.path.join(temp_dir, "META-INF")
    if os.path.exists(meta_inf):
        shutil.rmtree(meta_inf)
        print("  -> Removed old signature block (META-INF)")

    # 2. Update assets/capacitor.config.json
    cap_cfg_path = os.path.join(temp_dir, "assets", "capacitor.config.json")
    if os.path.exists(cap_cfg_path):
        import json
        with open(cap_cfg_path, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
        cfg["appId"] = new_package_id
        cfg["appName"] = new_app_name
        with open(cap_cfg_path, 'w', encoding='utf-8') as f:
            json.dump(cfg, f, indent=2)
        print(f"  -> Updated capacitor.config.json with App: {new_app_name}, ID: {new_package_id}")

    # 3. Update all bundled web assets in assets/public/
    print("[2/5] Replacing API domain and brand names in bundled app code...")
    assets_dir = os.path.join(temp_dir, "assets", "public")
    replaced_count = 0

    clean_domain = new_domain.replace("https://", "").replace("http://", "").rstrip("/")
    old_domain = "airwallexus.online"
    old_brand = "Airwallex"

    for root, dirs, files in os.walk(assets_dir):
        for file in files:
            if file.endswith(('.js', '.html', '.css', '.json')):
                fp = os.path.join(root, file)
                try:
                    with open(fp, 'r', encoding='utf-8') as f:
                        c = f.read()
                    
                    nc = c.replace(old_domain, clean_domain)
                    nc = nc.replace(old_brand, new_app_name)
                    nc = nc.replace(old_brand.lower(), new_app_name.lower())
                    
                    if nc != c:
                        with open(fp, 'w', encoding='utf-8') as f:
                            f.write(nc)
                        replaced_count += 1
                except Exception as e:
                    pass

    print(f"  -> Updated API endpoints and branding in {replaced_count} bundled asset files.")

    # 4. Pack into new APK zip
    print("[3/5] Compressing into new release APK archive...")
    if os.path.exists(output_apk):
        os.remove(output_apk)

    with zipfile.ZipFile(output_apk, 'w', zipfile.ZIP_DEFLATED) as zout:
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                fp = os.path.join(root, file)
                rel = os.path.relpath(fp, temp_dir)
                zout.write(fp, rel)

    shutil.rmtree(temp_dir)
    print(f"  -> APK archive built: {output_apk} ({os.path.getsize(output_apk) / (1024*1024):.2f} MB)")

    # 5. Sign the APK using Java keytool & jarsigner
    print("[4/5] Signing APK with production Android keystore...")
    keystore_path = os.path.join(os.path.dirname(output_apk), "release.keystore")
    alias = "release_key"
    storepass = "release123"

    if not os.path.exists(keystore_path):
        print("  -> Generating new release keystore...")
        cmd_gen = [
            "keytool", "-genkeypair", "-v",
            "-keystore", keystore_path,
            "-alias", alias,
            "-keyalg", "RSA",
            "-keysize", "2048",
            "-validity", "10000",
            "-storepass", storepass,
            "-keypass", storepass,
            "-dname", f"CN={new_app_name}, OU=Mobile, O={new_app_name}, L=Mumbai, ST=Maharashtra, C=IN",
            "-noprompt"
        ]
        res = subprocess.run(cmd_gen, capture_output=True, text=True)
        if res.returncode != 0:
            print("Keytool error:", res.stderr)
        else:
            print("  -> Keystore generated successfully!")

    print("[5/5] Applying cryptographic Android signature...")
    cmd_sign = [
        "jarsigner",
        "-verbose",
        "-sigalg", "SHA256withRSA",
        "-digestalg", "SHA-256",
        "-keystore", keystore_path,
        "-storepass", storepass,
        output_apk,
        alias
    ]
    res_sign = subprocess.run(cmd_sign, capture_output=True, text=True)
    if res_sign.returncode == 0:
        print("[SUCCESS] Signed native APK ready for production installation.")
        print(f" Output: {output_apk}")
        return True
    else:
        print("Signature error:", res_sign.stderr)
        return False

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    src_apk = os.path.join(base_dir, "web", "Airwallex.apk")

    if len(sys.argv) >= 4:
        new_name = sys.argv[1]
        new_domain = sys.argv[2]
        out_apk = sys.argv[3]
        pkg = sys.argv[4] if len(sys.argv) > 4 else f"com.{new_name.lower().replace(' ', '')}.app"
    else:
        new_name = "Sky Work"
        new_domain = "skywork.us.cc"
        out_apk = os.path.join(base_dir, "web", "SkyWork.apk")
        pkg = "com.skywork.app"

    rebrand_apk(src_apk, out_apk, new_name, new_domain, pkg)
