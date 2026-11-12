import shutil
import os

dest_www = os.path.abspath('android/app/src/main/assets/www')
os.makedirs(dest_www, exist_ok=True)

# Copy static directory to android assets www/static
shutil.copytree('static', os.path.join(dest_www, 'static'), dirs_exist_ok=True)

# Copy manifest.json
shutil.copy('static/manifest.json', os.path.join(dest_www, 'manifest.json'))

# Copy and adapt index.html with relative paths
with open('templates/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

adapted_content = content.replace('href="/static/', 'href="static/').replace('src="/static/', 'src="static/').replace('href="/manifest.json"', 'href="manifest.json"')

with open(os.path.join(dest_www, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(adapted_content)

print(f"Web assets copied to {dest_www} successfully!")
