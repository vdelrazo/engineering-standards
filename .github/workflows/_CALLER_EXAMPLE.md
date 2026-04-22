# Cómo integrar un repo nuevo al flujo del equipo

Copia los dos archivos de abajo en `.github/workflows/` del repo destino.
Solo necesitas el secret `PROJECT_TOKEN` configurado a nivel org (ya existe).

---

## 1. `project-automation.yml` — automatización del board

```yaml
# .github/workflows/project-automation.yml
name: Project Automation

on:
  pull_request:
    types: [opened, reopened]
  create:

jobs:
  automate:
    uses: tiendas-3b/ffss-engineering-standards/.github/workflows/project-automation.yml@main
    secrets:
      PROJECT_TOKEN: ${{ secrets.PROJECT_TOKEN }}
```

---

## 2. `sync-labels.yml` — sincronizar labels

```yaml
# .github/workflows/sync-labels.yml
name: Sync Labels

on:
  workflow_dispatch:  # correr manualmente desde Actions tab

jobs:
  sync:
    uses: tiendas-3b/ffss-engineering-standards/.github/workflows/sync-labels.yml@main
    secrets:
      PROJECT_TOKEN: ${{ secrets.PROJECT_TOKEN }}
```

Después de agregar este workflow, ve a **Actions → Sync Labels → Run workflow** una vez.
Los labels quedarán disponibles en el repo para que el equipo los asigne a los issues.

---

## Checklist al integrar un repo nuevo

- [ ] Agregar el repo al Project #6 (`tiendas-3b` → Projects → #6 → Settings → Linked repositories)
- [ ] Copiar `project-automation.yml` en `.github/workflows/`
- [ ] Copiar `sync-labels.yml` en `.github/workflows/`
- [ ] Correr **Sync Labels** manualmente una vez
- [ ] Verificar que `PROJECT_TOKEN` existe como secret a nivel org
