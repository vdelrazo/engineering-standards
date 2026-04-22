module.exports = async ({ github, context }) => {
  const org = 'vdelrazo';
  const projectNumber = 1;

  // ─── IDs de campos custom (generados por create-project-fields.js) ───────────
  const INICIATIVA_FIELD_ID = 'PVTSSF_lAHOAPe-kM4BUpLnzhQxQLo';
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

  // 1. Obtener el Project ID y campos
  const projectQuery = await github.graphql(
    `query($org: String!, $number: Int!) {
      organization(login: $org) {
        projectV2(number: $number) {
          id
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options { id name }
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

  const reviewOption = statusField.options.find(o => o.name.includes('Review'));
  if (!reviewOption) {
    console.log('Opción Review no encontrada — verifica el nombre exacto de la columna');
    return;
  }

  // 2. Agregar el PR al proyecto
  const prNodeId = context.payload.pull_request.node_id;
  const addItem = await github.graphql(
    `mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }`,
    { projectId, contentId: prNodeId }
  );
  const itemId = addItem.addProjectV2ItemById.item.id;

  // 3. Mover el item a "Review"
  await github.graphql(
    `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) {
        projectV2Item { id }
      }
    }`,
    { projectId, itemId, fieldId: statusField.id, optionId: reviewOption.id }
  );
  console.log(`PR movido a Review en Project #${projectNumber}`);

  // 4. Setear campo Iniciativa desde los labels del PR
  // El PR hereda los mismos labels que el issue vinculado si se usa la convención de branch
  // Convención de label: iniciativa:<slug>   ej: iniciativa:migracion-celex
  const prLabels = context.payload.pull_request.labels.map(l => l.name);
  const iniciativaLabel = prLabels.find(l => l.startsWith('iniciativa:'));

  if (!iniciativaLabel) {
    console.log('Sin label iniciativa:xxx en el PR — campo Iniciativa no seteado (se puede asignar manualmente en el Project)');
    return;
  }

  const slug = iniciativaLabel.replace('iniciativa:', '').trim();
  const optionId = INICIATIVA_OPTIONS[slug];

  if (!optionId) {
    console.log(`Label "${iniciativaLabel}" no tiene mapping — slugs válidos: ${Object.keys(INICIATIVA_OPTIONS).join(', ')}`);
    return;
  }

  await github.graphql(
    `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) {
        projectV2Item { id }
      }
    }`,
    { projectId, itemId, fieldId: INICIATIVA_FIELD_ID, optionId }
  );
  console.log(`Campo Iniciativa seteado a "${slug}" en PR`);
};
