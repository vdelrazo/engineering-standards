module.exports = async ({ github, context }) => {
  const org = 'vdelrazo';
  const projectNumber = 1;

  // ─── IDs de campos custom ────────────────────────────────────────────────────
  const INICIATIVA_FIELD_ID  = 'PVTSSF_lAHOAPe-kM4BUpLnzhQxQLo';
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

  const issue     = context.payload.issue;
  const issueNodeId = issue.node_id;
  const labels    = issue.labels.map(l => l.name);

  // Solo actuar si el issue NO tiene un branch asociado
  // (evita doble movimiento si ya lo movió move-to-dev.js via branch)
  // Convención: si tiene label "has-branch" lo saltamos
  if (labels.includes('has-branch')) {
    console.log('Issue tiene branch asociado — skip (ya lo maneja move-to-dev.js)');
    return;
  }

  // Obtener Project ID y campo Status
  const projectQuery = await github.graphql(
    `query($owner: String!, $number: Int!) {
      user(login: $owner) {
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
    { owner: org, number: projectNumber }
  );

  const project   = projectQuery.user.projectV2;
  const projectId = project.id;

  const statusField = project.fields.nodes.find(f => f.name === 'Status');
  if (!statusField) {
    console.log('Campo Status no encontrado');
    return;
  }

  const devOption = statusField.options.find(o => o.name.toLowerCase().includes('progress'));
  if (!devOption) {
    console.log('Opción In Progress no encontrada');
    return;
  }

  // Agregar issue al proyecto
  const addItem = await github.graphql(
    `mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }`,
    { projectId, contentId: issueNodeId }
  );
  const itemId = addItem.addProjectV2ItemById.item.id;

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

  // Mover a In Progress
  await setField(statusField.id, { singleSelectOptionId: devOption.id });
  console.log(`Issue #${issue.number} movido a In Progress (asignado a ${context.payload.assignee.login})`);

  // Fecha inicio = hoy
  const today = new Date().toISOString().split('T')[0];
  await setField(FECHA_INICIO_FIELD_ID, { date: today });
  console.log(`Fecha inicio seteada: ${today}`);

  // Iniciativa desde label
  const iniciativaLabel = labels.find(l => l.startsWith('iniciativa:'));
  if (!iniciativaLabel) {
    console.log('Sin label iniciativa:xxx — campo Iniciativa no seteado');
    return;
  }

  const slug     = iniciativaLabel.replace('iniciativa:', '').trim();
  const optionId = INICIATIVA_OPTIONS[slug];
  if (!optionId) {
    console.log(`Slug "${slug}" sin mapping`);
    return;
  }

  await setField(INICIATIVA_FIELD_ID, { singleSelectOptionId: optionId });
  console.log(`Campo Iniciativa seteado a "${slug}"`);
};
