# Order Exception Desk

A portfolio sandbox for wholesale order-entry teams. The sample PO maps customer part AF-102 to distributor SKU FLT-778. Its quantity is ambiguous. Confirm CASE, record the buyer's confirmation, and export the approved draft as 240 individual items. Choosing EACH keeps the order blocked because the unit price differs.

## Run locally

1. From the repository root, run `python -m pip install -r api/requirements.txt`.
2. In `api`, run `python -m uvicorn main:app --port 8000`.
3. In `web`, run `npm ci` then `npm run dev`. Open http://localhost:3000.

The demo uses SQLite locally. Upload a text-based PDF or UTF-8 text in the sample layout. The Source document tab shows the exact layout expected by the deterministic parser. To enable model extraction for varied English-language layouts in a controlled environment, set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` on the backend. Uploaded document text is sent to that provider when configured. Leave the key unset for a public sandbox. Scanned PDFs need OCR, which is outside this version.

## Deploy

- Import the repo into Render with the supplied blueprint. Set `DATABASE_URL` to the dedicated Supabase Postgres connection string. The backend creates the demo table on first use.
- Import the same repo into Vercel with root directory `web`. Set `BACKEND_URL` to the Render service origin before building.
- Open the Vercel URL and run the sample through approval and CSV export.

The sandbox uses browser-scoped demo sessions and a synthetic catalog, terms and inventory. It is intended for synthetic data. A real distributor rollout needs authenticated reviewer accounts, catalog imports, document retention controls and ERP integration. The current backend uses deterministic checks and keyword retrieval over synthetic customer terms. Model extraction can be enabled separately. Model-generated grounded explanations and model-directed tool orchestration are future work.

## Evaluation

Run `cd api && python evaluate.py` for 40 synthetic cases covering missing units, price mismatches, stock, unmatched products and valid orders. This benchmark evaluates deterministic rules. The run trace exposes model token usage if a model was used, plus elapsed analysis time.

## Public demo

[Open Order Exception Desk](https://order-exception-desk.vercel.app/). The public demo uses a sample order and browser storage. It supports reviewing, approving, exporting and resetting that order. For uploads and backend persistence, run the connected setup above. To build the standalone demo, set `NEXT_PUBLIC_STANDALONE_DEMO=true` when running `npm run build`.
