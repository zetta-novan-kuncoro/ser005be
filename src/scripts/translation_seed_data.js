// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************
/**
 * Returns the static translation seed definitions.
 *
 * @returns {Array<Object>}
 */
function GetTranslationDefinitions() {
  return [
    { key: 'common.loading', namespace: 'common', en: 'Loading...', fr: 'Chargement...', es: 'Cargando...', id: 'Memuat...' },
    { key: 'common.error', namespace: 'common', en: 'An error occurred', fr: 'Une erreur est survenue', es: 'Ocurrió un error', id: 'Terjadi kesalahan' },
    { key: 'common.save', namespace: 'common', en: 'Save', fr: 'Enregistrer', es: 'Guardar', id: 'Simpan' },
    { key: 'common.cancel', namespace: 'common', en: 'Cancel', fr: 'Annuler', es: 'Cancelar', id: 'Batal' },
    { key: 'embed.changelog.title', namespace: 'embed', en: "What's New", fr: 'Nouveautes', es: 'Novedades', id: 'Yang Baru' },
    { key: 'embed.evolution.submit', namespace: 'embed', en: 'Submit Request', fr: 'Soumettre une demande', es: 'Enviar solicitud', id: 'Kirim Permintaan' },
    { key: 'embed.roadmap.title', namespace: 'embed', en: 'Roadmap', fr: 'Feuille de route', es: 'Hoja de ruta', id: 'Peta Jalan' },
    { key: 'changelog.status.published', namespace: 'changeLogs', en: 'Published', fr: 'Publie', es: 'Publicado', id: 'Diterbitkan' },
    { key: 'changelog.status.draft', namespace: 'changeLogs', en: 'Draft', fr: 'Brouillon', es: 'Borrador', id: 'Draf' },
    { key: 'applications.title', namespace: 'applications', en: 'Applications', fr: 'Applications', es: 'Aplicaciones', id: 'Aplikasi' },
    { key: 'deletePhaseTitle', namespace: 'roadmap', en: 'Delete Phase', fr: 'Supprimer la Phase', es: 'Eliminar Fase', id: 'Hapus Fase' },
    { key: 'deletePhaseText', namespace: 'roadmap', en: 'Are you sure you want to delete this phase? This action cannot be undone.', fr: 'Etes-vous sur de vouloir supprimer cette phase ? Cette action est irreversible.', es: 'Esta seguro de que desea eliminar esta fase? Esta accion no se puede deshacer.', id: 'Apakah Anda yakin ingin menghapus fase ini? Tindakan ini tidak dapat dibatalkan.' },
    { key: 'deleteConfirm', namespace: 'roadmap', en: 'Delete', fr: 'Supprimer', es: 'Eliminar', id: 'Hapus' },
    { key: 'orderPlaceholder', namespace: 'roadmap', en: 'Order', fr: 'Ordre', es: 'Orden', id: 'Urutan' },
    { key: 'phasePlaceholder', namespace: 'roadmap', en: 'Phase name', fr: 'Nom de la phase', es: 'Nombre de la fase', id: 'Nama fase' },
    { key: 'descPlaceholder', namespace: 'roadmap', en: 'Description (optional)', fr: 'Description (optionnel)', es: 'Descripcion (opcional)', id: 'Deskripsi (opsional)' },
    { key: 'descEditPlaceholder', namespace: 'roadmap', en: 'Description', fr: 'Description', es: 'Descripcion', id: 'Deskripsi' },
    { key: 'noRequests', namespace: 'roadmap', en: 'No requests in this phase.', fr: 'Aucune demande dans cette phase.', es: 'No hay solicitudes en esta fase.', id: 'Tidak ada permintaan dalam fase ini.' },
    { key: 'unassigned', namespace: 'roadmap', en: 'Unassigned', fr: 'Non assigne', es: 'Sin asignar', id: 'Belum ditetapkan' },
    { key: 'notInRoadmap', namespace: 'changeLogs', en: 'Not in Roadmap', fr: 'Hors Feuille de route', es: 'Fuera del roadmap', id: 'Tidak ada di roadmap' },
    { key: 'fieldExpectedDate', namespace: 'embed', en: 'Expected Date', fr: 'Date prevue', es: 'Fecha esperada', id: 'Tanggal yang diharapkan' },
    { key: 'submit.success.title', namespace: 'evolutionRequests', en: 'Request Submitted', fr: 'Demande soumise', es: 'Solicitud enviada', id: 'Permintaan terkirim' },
    { key: 'submit.success.text', namespace: 'evolutionRequests', en: 'Your request has been submitted successfully.', fr: 'Votre demande a ete soumise avec succes.', es: 'Su solicitud ha sido enviada con exito.', id: 'Permintaan Anda telah berhasil dikirim.' },
    { key: 'status.draft', namespace: 'changeLogs', en: 'Draft', fr: 'Brouillon', es: 'Borrador', id: 'Draf' },
    { key: 'status.published', namespace: 'changeLogs', en: 'Published', fr: 'Publie', es: 'Publicado', id: 'Dipublikasikan' },
    { key: 'status.deprecated', namespace: 'changeLogs', en: 'Deprecated', fr: 'Obsolete', es: 'Obsoleto', id: 'Usang' },
    { key: 'status.rolledback', namespace: 'changeLogs', en: 'Rolled Back', fr: 'Annule', es: 'Revertido', id: 'Dikembalikan' },
    { key: 'showKey', namespace: 'apiKeyManager', en: 'Show key', fr: 'Afficher la cle', es: 'Mostrar clave', id: 'Tampilkan kunci' },
    { key: 'hideKey', namespace: 'apiKeyManager', en: 'Hide key', fr: 'Masquer la cle', es: 'Ocultar clave', id: 'Sembunyikan kunci' },
    { key: 'headerTitle', namespace: 'dev', en: 'DEV - Testing & Sandbox', fr: 'DEV - Tests & Sandbox', es: 'DEV - Pruebas y Sandbox', id: 'DEV - Pengujian & Sandbox' },
    { key: 'headerSubtitle', namespace: 'dev', en: 'Test endpoints and simulate the Embed page', fr: 'Tester les endpoints et simuler la page Embed', es: 'Probar endpoints y simular la pagina Embed', id: 'Uji endpoint dan simulasikan halaman Embed' },
    { key: 'tabSandbox', namespace: 'dev', en: 'Embed Sandbox', fr: 'Sandbox Embed', es: 'Sandbox de Embed', id: 'Sandbox Embed' },
    { key: 'tabTest', namespace: 'dev', en: 'Test Scenarios', fr: 'Scenarios de Test', es: 'Escenarios de Prueba', id: 'Skenario Uji' },
    { key: 'tabDocumentation', namespace: 'dev', en: 'Documentation', fr: 'Documentation', es: 'Documentacion', id: 'Dokumentasi' },
    { key: 'applicationLabel', namespace: 'dev', en: 'Application', fr: 'Application', es: 'Aplicacion', id: 'Aplikasi' },
    { key: 'applicationPlaceholder', namespace: 'dev', en: '-- Select an application --', fr: '-- Selectionner une application --', es: '-- Seleccionar una aplicacion --', id: '-- Pilih aplikasi --' },
    { key: 'apiKeyLabel', namespace: 'dev', en: 'API Key', fr: 'Cle API', es: 'Clave API', id: 'Kunci API' },
    { key: 'apiKeyPlaceholder', namespace: 'dev', en: '-- Select an API key --', fr: '-- Selectionner une cle API --', es: '-- Seleccionar una clave API --', id: '-- Pilih kunci API --' },
    { key: 'languageLabel', namespace: 'dev', en: 'Language', fr: 'Langue', es: 'Idioma', id: 'Bahasa' },
    { key: 'themeLabel', namespace: 'dev', en: 'Theme', fr: 'Theme', es: 'Tema', id: 'Tema' },
    { key: 'themeClear', namespace: 'dev', en: 'Clear', fr: 'Clair', es: 'Claro', id: 'Terang' },
    { key: 'themeDark', namespace: 'dev', en: 'Dark', fr: 'Sombre', es: 'Oscuro', id: 'Gelap' },
    { key: 'themeWcag', namespace: 'dev', en: 'WCAG', fr: 'WCAG', es: 'WCAG', id: 'WCAG' },
    { key: 'embedPreviewTitle', namespace: 'dev', en: 'Embed Preview', fr: 'Apercu Embed', es: 'Vista previa de Embed', id: 'Pratinjau Embed' },
    { key: 'embedPreviewUnavailable', namespace: 'dev', en: 'DEV embed preview is unavailable until a separate plaintext key access design is approved.', fr: 'L apercu Embed DEV n est pas disponible tant qu un acces separe aux cles en clair n a pas ete valide.', es: 'La vista previa DEV de Embed no esta disponible hasta que se apruebe un diseno separado de acceso a claves en texto plano.', id: 'Pratinjau embed DEV tidak tersedia sampai desain akses kunci plaintext terpisah disetujui.' },
    { key: 'scenario1Title', namespace: 'dev', en: 'Scenario 1: Submit Fix Request', fr: 'Scenario 1 : Soumettre une demande de correctif', es: 'Escenario 1: Enviar solicitud de correccion', id: 'Skenario 1: Kirim Permintaan Perbaikan' },
    { key: 'scenario1Description', namespace: 'dev', en: 'Test submitting a "Fix" type evolution request with sample data.', fr: 'Tester l envoi d une demande de type "Correctif" avec des donnees d exemple.', es: 'Probar el envio de una solicitud de tipo "Correccion" con datos de ejemplo.', id: 'Uji pengiriman permintaan tipe "Perbaikan" dengan data contoh.' },
    { key: 'scenario2Title', namespace: 'dev', en: 'Scenario 2: Submit Changelog', fr: 'Scenario 2 : Soumettre un changelog', es: 'Escenario 2: Enviar changelog', id: 'Skenario 2: Kirim Changelog' },
    { key: 'scenario2Description', namespace: 'dev', en: 'Test submitting a new changelog entry with sample data.', fr: 'Tester l envoi d une nouvelle entree de changelog avec des donnees d exemple.', es: 'Probar el envio de una nueva entrada de changelog con datos de ejemplo.', id: 'Uji pengiriman entri changelog baru dengan data contoh.' },
    { key: 'selectedApplication', namespace: 'dev', en: 'Application: {reference}', fr: 'Application : {reference}', es: 'Aplicacion: {reference}', id: 'Aplikasi: {reference}' },
    { key: 'noApplicationAvailable', namespace: 'dev', en: 'No application available', fr: 'Aucune application disponible', es: 'No hay ninguna aplicacion disponible', id: 'Tidak ada aplikasi yang tersedia' },
    { key: 'runTest', namespace: 'dev', en: 'Run Test', fr: 'Lancer le test', es: 'Ejecutar prueba', id: 'Jalankan Uji' },
    { key: 'running', namespace: 'dev', en: 'Running...', fr: 'Execution...', es: 'Ejecutando...', id: 'Sedang berjalan...' },
    { key: 'devTestKeyCreateFailed', namespace: 'dev', en: 'DEV test API key could not be created.', fr: 'La cle API de test DEV n a pas pu etre creee.', es: 'No se pudo crear la clave API de prueba DEV.', id: 'Kunci API uji DEV tidak dapat dibuat.' },
    { key: 'devTestKeyDisabled', namespace: 'dev', en: 'DEV test API keys are disabled in production.', fr: 'Les cles API de test DEV sont desactivees en production.', es: 'Las claves API de prueba DEV estan deshabilitadas en produccion.', id: 'Kunci API uji DEV dinonaktifkan di produksi.' },
    { key: 'genericError', namespace: 'dev', en: 'An unexpected error occurred.', fr: 'Une erreur inattendue est survenue.', es: 'Ocurrio un error inesperado.', id: 'Terjadi kesalahan yang tidak terduga.' },
    { key: 'fixRequestTitle', namespace: 'dev', en: 'Test Fix Request', fr: 'Demande de correctif de test', es: 'Solicitud de correccion de prueba', id: 'Permintaan Perbaikan Uji' },
    { key: 'fixRequestDescription', namespace: 'dev', en: 'This is a test fix submission from DEV', fr: 'Ceci est une demande de correctif de test depuis DEV', es: 'Esta es una solicitud de correccion de prueba desde DEV', id: 'Ini adalah permintaan perbaikan uji dari DEV' },
    { key: 'testUserLabel', namespace: 'dev', en: 'Test User', fr: 'Utilisateur de test', es: 'Usuario de prueba', id: 'Pengguna Uji' },
    { key: 'fixScenarioSuccess', namespace: 'dev', en: 'Fix request submitted successfully (request_id: {requestId}) using a short-lived DEV test API key. Note: cleanup not available in v1.', fr: 'La demande de correctif a ete soumise avec succes (request_id : {requestId}) avec une cle API de test DEV a courte duree de vie. Remarque : aucun nettoyage n est disponible en v1.', es: 'La solicitud de correccion se envio correctamente (request_id: {requestId}) usando una clave API de prueba DEV de corta duracion. Nota: la limpieza no esta disponible en v1.', id: 'Permintaan perbaikan berhasil dikirim (request_id: {requestId}) menggunakan kunci API uji DEV yang berumur singkat. Catatan: pembersihan belum tersedia di v1.' },
    { key: 'testChangelogTitle', namespace: 'dev', en: 'Test Changelog', fr: 'Changelog de test', es: 'Changelog de prueba', id: 'Changelog Uji' },
    { key: 'testChangelogSummary', namespace: 'dev', en: 'Test changelog submission from DEV', fr: 'Soumission de changelog de test depuis DEV', es: 'Envio de changelog de prueba desde DEV', id: 'Pengiriman changelog uji dari DEV' },
    { key: 'testChangelogDetails', namespace: 'dev', en: '# Test Changelog\n\nThis is a test changelog entry.', fr: '# Changelog de test\n\nCeci est une entree de changelog de test.', es: '# Changelog de prueba\n\nEsta es una entrada de changelog de prueba.', id: '# Changelog Uji\n\nIni adalah entri changelog uji.' },
    { key: 'changelogScenarioSuccess', namespace: 'dev', en: 'Changelog submitted successfully (entry_id: {entryId}). Note: cleanup not available in v1.', fr: 'Le changelog a ete soumis avec succes (entry_id : {entryId}). Remarque : aucun nettoyage n est disponible en v1.', es: 'El changelog se envio correctamente (entry_id: {entryId}). Nota: la limpieza no esta disponible en v1.', id: 'Changelog berhasil dikirim (entry_id: {entryId}). Catatan: pembersihan belum tersedia di v1.' },
    { key: 'description', namespace: 'evolutionRequests', en: 'Description', fr: 'Description', es: 'Descripción', id: 'Deskripsi' },
    { key: 'submittedBy', namespace: 'evolutionRequests', en: 'Submitted By', fr: 'Soumis par', es: 'Enviado por', id: 'Dikirim oleh' },
    { key: 'expectedDate', namespace: 'evolutionRequests', en: 'Expected Date', fr: 'Date prévue', es: 'Fecha esperada', id: 'Tanggal yang diharapkan' },
    { key: 'attachments', namespace: 'evolutionRequests', en: 'Attachments', fr: 'Pièces jointes', es: 'Adjuntos', id: 'Lampiran' },
    { key: 'rejectionReason', namespace: 'evolutionRequests', en: 'Rejection Reason', fr: 'Raison du rejet', es: 'Motivo del rechazo', id: 'Alasan penolakan' },
    { key: 'descriptionLabel', namespace: 'embed', en: 'Description', fr: 'Description', es: 'Descripción', id: 'Deskripsi' },
    { key: 'fieldSubmittedOn', namespace: 'embed', en: 'Submitted On', fr: 'Soumis le', es: 'Enviado el', id: 'Dikirim pada' },
    { key: 'fieldAttachments', namespace: 'embed', en: 'Attachments', fr: 'Pièces jointes', es: 'Adjuntos', id: 'Lampiran' },
  ];
}

// *************** EXPORT MODULE ***************
module.exports = { GetTranslationDefinitions };
