import os
from PIL import Image, ImageDraw

SRC_PATH = r"C:/Users/REYANSH/.gemini/antigravity/brain/dc50bb49-dbaf-42e5-aabe-43c610b23db6/.user_uploaded/media_1794420684121_310abc5c.jpg"

def make_square(img):
    w, h = img.size
    size = max(w, h)
    new_img = Image.new("RGBA", (size, size), (18, 24, 38, 255))
    paste_x = (size - w) // 2
    paste_y = (size - h) // 2
    new_img.paste(img, (paste_x, paste_y))
    return new_img

def make_round(img):
    size = img.size
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0) + size, fill=255)
    
    round_img = Image.new('RGBA', size, (0, 0, 0, 0))
    round_img.paste(img, (0, 0), mask=mask)
    return round_img

def main():
    orig = Image.open(SRC_PATH).convert("RGBA")
    square_img = make_square(orig)

    # 1. Web App Icons
    web_targets = {
        "static/icons/logo.png": 512,
        "static/icons/favicon.png": 32,
        "static/icons/favicon-48x48.png": 48,
        "static/icons/apple-touch-icon.png": 180,
        "static/icons/icon-192x192.png": 192,
        "static/icons/icon-512x512.png": 512,
        "static/icons/icon-maskable-192x192.png": 192,
        "static/icons/icon-maskable-512x512.png": 512,
    }

    os.makedirs("static/icons", exist_ok=True)
    for path, sz in web_targets.items():
        resized = square_img.resize((sz, sz), Image.Resampling.LANCZOS)
        resized.save(path, format="PNG", optimize=True)
        print(f"Generated {path} ({sz}x{sz})")

    # 2. Play Store 512x512 asset
    playstore_icon = square_img.resize((512, 512), Image.Resampling.LANCZOS)
    playstore_icon.save("android/playstore-icon-512x512.png", format="PNG", optimize=True)
    print("Generated android/playstore-icon-512x512.png (512x512)")

    # 3. Android Mipmap densities
    android_densities = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }

    for dens, sz in android_densities.items():
        dir_path = f"android/app/src/main/res/mipmap-{dens}"
        os.makedirs(dir_path, exist_ok=True)
        
        # Standard launcher icon
        normal_icon = square_img.resize((sz, sz), Image.Resampling.LANCZOS)
        normal_path = os.path.join(dir_path, "ic_launcher.png")
        normal_icon.save(normal_path, format="PNG", optimize=True)
        
        # Round launcher icon
        round_icon = make_round(normal_icon)
        round_path = os.path.join(dir_path, "ic_launcher_round.png")
        round_icon.save(round_path, format="PNG", optimize=True)
        
        print(f"Generated Android {dens} icons ({sz}x{sz}): ic_launcher.png & ic_launcher_round.png")

    print("\nAll icons generated successfully from the new OnTrack logo!")

if __name__ == "__main__":
    main()
