import os
import shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter

os.makedirs('play_store_assets', exist_ok=True)

# 1. Copy 512x512 Icon
shutil.copy('static/icons/icon-512x512.png', 'play_store_assets/play_store_icon_512x512.png')

# 2. Copy the generated release bundle
aab_src = 'android/app/build/outputs/bundle/release/app-release.aab'
if os.path.exists(aab_src):
    shutil.copy(aab_src, 'play_store_assets/app-release.aab')

# 3. Create Feature Graphic (1024 x 500)
width = 1024
height = 500

# Deep rich dark gradient (#0F111E to #1B1E34)
feature_img = Image.new('RGB', (width, height), color=(18, 22, 39))
draw = ImageDraw.Draw(feature_img)

# Gradient background
for y in range(height):
    ratio = y / height
    r = int(18 * (1 - ratio) + 28 * ratio)
    g = int(22 * (1 - ratio) + 34 * ratio)
    b = int(42 * (1 - ratio) + 65 * ratio)
    draw.line([(0, y), (width, y)], fill=(r, g, b))

# Add glow circles
glow_layer = Image.new('RGBA', (width, height), (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow_layer)

# Indigo glow left
glow_draw.ellipse([60, 60, 420, 420], fill=(99, 102, 241, 45))
# Purple glow center
glow_draw.ellipse([340, 40, 720, 420], fill=(139, 92, 246, 50))
# Emerald glow right
glow_draw.ellipse([640, 80, 960, 400], fill=(16, 185, 129, 35))

glow_blurred = glow_layer.filter(ImageFilter.GaussianBlur(55))
feature_img.paste(glow_blurred, (0, 0), glow_blurred)

# Load OnTrack Logo
logo_path = 'static/icons/logo.png'
if os.path.exists(logo_path):
    logo = Image.open(logo_path).convert('RGBA')
    logo_size = 220
    logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    
    # Rounded corners for logo
    mask = Image.new('L', (logo_size, logo_size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, logo_size, logo_size], radius=48, fill=255)
    
    # Shadow under logo
    shadow = Image.new('RGBA', (logo_size + 40, logo_size + 40), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.rounded_rectangle([15, 15, logo_size + 25, logo_size + 25], radius=48, fill=(0, 0, 0, 140))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    
    # Place on left center
    logo_x = 120
    logo_y = (height - logo_size) // 2
    feature_img.paste(shadow, (logo_x - 20, logo_y - 10), shadow)
    feature_img.paste(logo, (logo_x, logo_y), mask)

# Draw text typography on the right
draw = ImageDraw.Draw(feature_img)
try:
    font_title = ImageFont.truetype("arialbd.ttf", 64)
    font_sub = ImageFont.truetype("arial.ttf", 26)
    font_badge = ImageFont.truetype("arialbd.ttf", 18)
except:
    font_title = ImageFont.load_default()
    font_sub = ImageFont.load_default()
    font_badge = ImageFont.load_default()

text_x = 400
# Badge pill: "NEXT-GEN HABIT & FOCUS ENGINE"
badge_text = "✦ NEXT-GEN HABIT & FOCUS ENGINE"
draw.rounded_rectangle([text_x, 115, text_x + 360, 150], radius=18, fill=(99, 102, 241, 80), outline=(139, 92, 246, 200))
draw.text((text_x + 18, 123), badge_text, font=font_badge, fill=(224, 231, 255))

# Title: "OnTrack"
draw.text((text_x, 168), "OnTrack", font=font_title, fill=(255, 255, 255))

# Subtitle / Tagline
draw.text((text_x, 250), "Build Unbreakable Habits.", font=font_sub, fill=(241, 245, 249))
draw.text((text_x, 288), "Level Up Your Focus. 100% Offline.", font=font_sub, fill=(148, 163, 184))

# Feature Pills row
pills = ["⚡ Atomic Stacks", "🛡️ Streak Shields", "📊 Day-by-Day Charts"]
px = text_x
for p in pills:
    pill_w = len(p) * 11 + 24
    draw.rounded_rectangle([px, 350, px + pill_w, 386], radius=18, fill=(30, 41, 59), outline=(51, 65, 85))
    draw.text((px + 12, 358), p, font=font_badge, fill=(226, 232, 240))
    px += pill_w + 12

feature_img.save('play_store_assets/feature_graphic_1024x500.png', 'PNG')
print("Play Store assets prepared successfully!")
