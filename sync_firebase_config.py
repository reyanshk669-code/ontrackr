import os
import shutil

downloads_dir = os.path.expanduser('~/Downloads')
target_dir = os.path.abspath('android/app')
target_file = os.path.join(target_dir, 'google-services.json')

source_file = os.path.join(downloads_dir, 'google-services.json')

if os.path.exists(source_file):
    shutil.copy(source_file, target_file)
    print(f"SUCCESS: Copied {source_file} -> {target_file}")
else:
    print(f"WAITING: Please download google-services.json from Firebase Console into your Downloads folder.")
