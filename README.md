# Voedingsdagboek

Simple food diary web app. No build step; data is stored in the browser (`localStorage`).

## Run

```bash
python3 -m http.server 8000
```

Open http://localhost:8000.

## Features
- Add food with carbs, protein, fat, fiber, sugar, salt
- Calories auto-calculated (4/4/9 kcal per g) or entered manually
- Day overview with totals, daily goal and macro split
- Week overview (Mon–Sun) with chart, total and daily average
- Edit/delete entries, JSON export/import
