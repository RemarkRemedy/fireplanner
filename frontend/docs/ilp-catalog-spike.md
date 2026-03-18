# ILP Catalog Spike Report

Generated at: 2026-03-12T13:59:55.311Z

## Corpus

This report covers the 5 initial product-summary PDFs selected for the manual-corpus parser spike.

## Results

### HSBC Life — Wealth Accelerate

- Source file: `HSBC Life Wealth Accelerate Product Summary.pdf`
- Pages: 31
- Extracted character count: 70962
- Text layer present: yes
- Sections detected: Policy section, Bonus section, Fees section, Withdrawal section, EEC section
- Fee tables look reconstructable: yes
- EEC rows look reconstructable: yes
- Bonus rules look structured: yes

### Prudential — PRUVantage Wealth II

- Source file: `PRUVantage Wealth II Product Summary.pdf`
- Pages: 21
- Extracted character count: 48045
- Text layer present: yes
- Sections detected: Policy section, Bonus section, Withdrawal section, EEC section
- Fee tables look reconstructable: yes
- EEC rows look reconstructable: yes
- Bonus rules look structured: yes

### Etiqa — Invest flex prime II

- Source file: `EIP_Invest flex prime II_Product Summary.pdf`
- Pages: 30
- Extracted character count: 57147
- Text layer present: yes
- Sections detected: Policy section, Bonus section, Fees section, Withdrawal section, EEC section
- Fee tables look reconstructable: yes
- EEC rows look reconstructable: yes
- Bonus rules look structured: yes

### FWD — Invest First Horizon

- Source file: `FWD Invest First Horizon Product Summary.pdf`
- Pages: 27
- Extracted character count: 58734
- Text layer present: yes
- Sections detected: Policy section, Bonus section, Fees section, Withdrawal section, EEC section
- Fee tables look reconstructable: yes
- EEC rows look reconstructable: yes
- Bonus rules look structured: no
- Notes:
  - Bonus wording is not obviously table-structured from raw text.

### Tokio Marine — TML_UNZV_TPDN_CIZ

- Source file: `TML_UNZV_TPDN_CIZ_Summary.pdf`
- Pages: 20
- Extracted character count: 55112
- Text layer present: yes
- Sections detected: Policy section, Bonus section, Fees section, Withdrawal section, EEC section
- Fee tables look reconstructable: yes
- EEC rows look reconstructable: yes
- Bonus rules look structured: yes

## Initial Read

- PDFs with clear text layers should proceed to structured extraction next.
- PDFs flagged as sparse or image-heavy should be marked unsupported for deterministic parsing in V1 until proven otherwise.