import sys
import os

project_root = os.path.dirname(os.path.dirname(os.path.abspath(file)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
    server_path = os.path.join(project_root, 'server')
if server_path not in sys.path:
    sys.path.insert(0, server_path)

from server.main import app  # ASGI app