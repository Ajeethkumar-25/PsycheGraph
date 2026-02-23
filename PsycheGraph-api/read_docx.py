import zipfile
import xml.etree.ElementTree as ET
import os

# Get the directory of the current script
base_dir = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(base_dir, "docx", "PsycheGraph_scope_updated.docx")

try:
    with zipfile.ZipFile(path, 'r') as docx:
        xml_content = docx.read('word/document.xml')
        tree = ET.fromstring(xml_content)
        
        # XML namespace for Word
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        
        text = []
        for p in tree.findall('.//w:p', ns):
            texts = [node.text for node in p.iterfind('.//w:t', ns) if node.text]
            if texts:
                text.append(''.join(texts))
            else:
                text.append('') # Preserve empty lines/paragraphs
        
        print('\n'.join(text))
except Exception as e:
    print(f"Error reading docx: {e}")
