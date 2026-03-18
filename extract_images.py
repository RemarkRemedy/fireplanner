import re
import base64

with open('/private/var/folders/zz/slnf7x5964jb7nh_n66__cj40000gn/T/gemini-prompt-860d5dc7-8ad4-46e7-b5cc-dec4a661c23c.txt', 'r') as f:
    content = f.read()

# Pattern to match: Image from @filename (image/png, ... bytes): data:image/png;base64,...
pattern = r"Image from @(.*?\.png).*?data:image/png;base64,([^\n\r]+)"
matches = re.findall(pattern, content)

for filename, b64_data in matches:
    print(f"Extracting {filename}")
    with open(filename, 'wb') as img_file:
        img_file.write(base64.b64decode(b64_data))
