const createAdminNotificationsController = require('../../src/controllers/adminNotificationsController');

describe('Admin Notifications Controller Suite', () => {
  test('deve instanciar os metodos do controller de notificacoes do admin', () => {
    const controller = createAdminNotificationsController({ dbService: {} });
    expect(typeof controller.adminNotificationsMinimo).toBe('function');
    expect(typeof controller.adminNotificationsAbaixo).toBe('function');
    expect(typeof controller.adminRegularizedTimeline).toBe('function');
  });
});