/**
 * i18n middleware — parses Accept-Language header and attaches
 * a locale-aware `res.sendError(key, status)` helper to every response.
 *
 * Supported locales: en, hi, es (falls back to en).
 */

const MESSAGES = {
  en: {
    ROUTE_NOT_FOUND:  'Route not found',
    SERVER_ERROR:     'Internal server error',
    UNAUTHORIZED:     'Please sign in to continue',
    FORBIDDEN:        'You do not have permission to perform this action',
    NOT_FOUND:        'Resource not found',
    VALIDATION:       'Validation error',
    EDIT_LOCKED:      'Review can no longer be edited after 24 hours',
    ALREADY_REVIEWED: 'You have already reviewed this route',
    JOURNEY_REQUIRED: 'You must complete a journey before reviewing',
    REPORT_RECORDED:  'Report recorded',
  },
  hi: {
    ROUTE_NOT_FOUND:  'रूट नहीं मिला',
    SERVER_ERROR:     'आंतरिक सर्वर त्रुटि',
    UNAUTHORIZED:     'कृपया साइन इन करें',
    FORBIDDEN:        'आपके पास यह करने की अनुमति नहीं है',
    NOT_FOUND:        'संसाधन नहीं मिला',
    VALIDATION:       'सत्यापन त्रुटि',
    EDIT_LOCKED:      '24 घंटे के बाद समीक्षा संपादित नहीं की जा सकती',
    ALREADY_REVIEWED: 'आपने पहले ही इस रूट की समीक्षा की है',
    JOURNEY_REQUIRED: 'समीक्षा करने से पहले यात्रा पूरी करें',
    REPORT_RECORDED:  'रिपोर्ट दर्ज की गई',
  },
  es: {
    ROUTE_NOT_FOUND:  'Ruta no encontrada',
    SERVER_ERROR:     'Error interno del servidor',
    UNAUTHORIZED:     'Por favor inicia sesión para continuar',
    FORBIDDEN:        'No tienes permiso para realizar esta acción',
    NOT_FOUND:        'Recurso no encontrado',
    VALIDATION:       'Error de validación',
    EDIT_LOCKED:      'La reseña ya no se puede editar después de 24 horas',
    ALREADY_REVIEWED: 'Ya has reseñado esta ruta',
    JOURNEY_REQUIRED: 'Debes completar un viaje antes de reseñar',
    REPORT_RECORDED:  'Reporte registrado',
  },
};

const SUPPORTED = Object.keys(MESSAGES);

function resolveLocale(req) {
  const header = req.headers['accept-language'] || '';
  const primary = header.split(',')[0].trim().split('-')[0].toLowerCase();
  return SUPPORTED.includes(primary) ? primary : 'en';
}

module.exports = function i18nMiddleware(req, res, next) {
  const locale = resolveLocale(req);
  req.locale = locale;

  // Attach helper: res.sendError('KEY', 404)
  res.sendError = (key, status = 500) => {
    const msg = (MESSAGES[locale] && MESSAGES[locale][key])
      ? MESSAGES[locale][key]
      : (MESSAGES.en[key] || key);
    return res.status(status).json({ error: msg, key });
  };

  next();
};
