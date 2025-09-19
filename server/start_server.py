import os
import uvicorn
import logging

# ログ設定
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

if __name__ == "__main__":
    # CPUコア数の半分に基づいてワーカー数を設定（最低1ワーカー）
    num_workers = max(1, (os.cpu_count() or 1) // 2)
    logging.info(f"Starting Uvicorn with {num_workers} workers (half of CPU cores).")
    
    # main.py の app オブジェクトを直接参照
    # Use PORT env var if provided (Cloud Run/other envs); default to 8000 for local
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True, workers=num_workers)
