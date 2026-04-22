module.exports = async ({ github, context }) => {
  const org = 'vdelrazo';
  const projectNumber = 1;

  // ─── IDs de campos custom (generados por create-project-fields.js) ───────────
  const INICIATIVA_FIELD_ID = 'PVTSSF_lAHOAPe-kM4BUpLnzhQxQLo';
  const FECHA_INICIO_FIELD_ID = 'PVTF_lAHOAPe-kM4BUpLnzhQxPJc';
  const INICIATIVA_OPTIONS = {
    'orders-api-platform': '3029b19b',
    'venta-financiada':    '904324c0',
    'migracion-celex':     '09c99a5e',
    'kiosko-remesas':      '9f132423',
    'cico-mercado-pago':   'a17fbccd',
    'conciliacion':        '43684fca',
    'kmp-kotlin-app':      '486c4bd7',
  };
  // ─────────────────────────────────────────────────────────────────────────────

  // 1. Extraer el número de issue del nombre del branch
  // Convención: feature/20-sandbox-credentials, fix/14-handler-create, chore/18-servicebus-config
  const ref = context.payload.ref;
  const match = ref.match(/^[^/]+\/(\d+)-/);
  if (!match) {
    console.log(`No se pudo extraer número de issue del branch '${ref}' — asegúrate de seguir la convención feature/NNN-descripción`);
    return;
  }
  const issueNumber = parseInt(match[1], 10);

  // 2. Obtener el issue (node_id + labels)
  const issueData = await github.rest.issues.get({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber
  });
  const issueNodeId = issueData.data.node_id;
  const labels = issueData.data.labels.map(l => l.name);

  // 3. Obtener Project ID y campo Status
  const projectQuery = await github.graphql(
    `query($org: String!, $number: Int!) {
      organization(login: $org) {
        projectV2(number: $number) {
          id
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id name options { id name }
              }
            }
          }
        }
      }
    }`,
    { org, number: projectNumber }
  );

  const project = projectQuery.organization.projectV2;
  const projectId = project.id;

  const statusField = project.fields.nodes.find(f => f.name === 'Status');
  if (!statusField) {
    console.log('Campo Status no encontrado — verifica el nombre en el Project');
    return;
  }

  const devOption = statusField.options.find(o => o.name.toLowerCase().includes('progress'));
  if (!devOption) {
    console.log('Opción In Progress no encontrada — verifica el nombre exacto de la columna');
    return;
  }

  // 4. Agregar el issue al proyecto
  const addItem = await github.graphql(
    `mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }`,
    { projectId, contentId: issueNodeId }
  );
  const itemId = addItem.addProjectV2ItemById.item.id;

  // Helper para setear un campo en el proyecto
  const setField = (fieldId, value) => github.graphql(
    `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: $value
      }) {
        projectV2Item { id }
      }
    }`,
    { projectId, itemId, fieldId, value }
  );

  // 5. Mover a "In Progress"
  await setField(statusField.id, { singleSelectOptionId: devOption.id });
  console.log(`Issue #${issueNumber} movido a In Progress en Project #${projectNumber}`);

  // 6. Setear Fecha inicio = hoy (formato ISO YYYY-MM-DD que espera la API)
  const today = new Date().toISOString().split('T')[0];
  await setField(FECHA_INICIO_FIELD_ID, { date: today });
  console.log(`Fecha inicio seteada: ${today}`);

  // 7. Setear Iniciativa si el issue tiene label iniciativa:xxx
  const iniciativaLabel = labels.find(l => l.startsWith('iniciativa:'));
  if (!iniciativaLabel) {
    console.log('Sin label iniciativa:xxx — campo Iniciativa no seteado (asignar manualmente en el Project)');
    return;
  }

  const slug = iniciativaLabel.replace('iniciativa:', '').trim();
  const optionId = INICIATIVA_OPTIONS[slug];
  if (!optionId) {
    console.log(`Label "${iniciativaLabel}" no tiene mapping — slugs válidos: ${Object.keys(INICIATIVA_OPTIONS).join(', ')}`);
    return;
  }

  await setField(INICIATIVA_FIELD_ID, { singleSelectOptionId: optionId });
  console.log(`Campo Iniciativa seteado a "${slug}"`);
};
