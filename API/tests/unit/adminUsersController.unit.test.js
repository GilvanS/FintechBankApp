const createAdminUsersController = require('../../src/controllers/adminUsersController');

describe('Admin Users Controller Suite - Limites de Crédito e PIX (Massa 44444444444)', () => {
  let mockDbService;
  let mockUsersRepo;
  let mockAuditLog;
  let mockRepoContext;
  let controller;

  beforeEach(() => {
    mockDbService = {
      executeQuery: jest.fn().mockResolvedValue([]),
      fq: jest.fn(tableName => `fintech.${tableName}`)
    };

    mockUsersRepo = {
      findByCpf: jest.fn(),
      listUsers: jest.fn()
    };

    mockAuditLog = jest.fn();

    mockRepoContext = {
      esc: jest.fn(val => val === null ? 'NULL' : `'${val}'`)
    };

    controller = createAdminUsersController({
      dbService: mockDbService,
      repoContext: mockRepoContext,
      usersRepo: mockUsersRepo,
      auditLog: mockAuditLog,
      normalizeUser: user => user,
      updatePixLimit: jest.fn().mockResolvedValue(true)
    });
  });

  test('deve instanciar os metodos do controller do admin', () => {
    expect(typeof controller.getOverdueMassesDashboard).toBe('function');
    expect(typeof controller.getAdminUsers).toBe('function');
    expect(typeof controller.getAdminUserByCpf).toBe('function');
    expect(typeof controller.adminUpdateCreditLimit).toBe('function');
    expect(typeof controller.adminUpdatePixLimit).toBe('function');
  });

  test('adminUpdateCreditLimit - deve atualizar totalLimit e availableLimit com sucesso para massa 44444444444', async () => {
    const req = {
      params: { cpf: '44444444444' },
      body: { totalLimit: 15000, availableLimit: 15000 },
      user: { cpf: '00000000000', role: 'admin' }
    };

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    mockUsersRepo.findByCpf
      .mockResolvedValueOnce({
        cpf: '44444444444',
        credit_card_total_limit: '5000.00',
        credit_card_available_limit: '5000.00'
      })
      .mockResolvedValueOnce({
        cpf: '44444444444',
        credit_card_total_limit: '15000.00',
        credit_card_available_limit: '15000.00'
      });

    await controller.adminUpdateCreditLimit(req, res);

    expect(mockUsersRepo.findByCpf).toHaveBeenCalledWith('44444444444');
    expect(mockDbService.executeQuery).toHaveBeenCalled();
    expect(mockAuditLog).toHaveBeenCalledWith(req, 'admin_credit_limit_update', 'info', {
      cpf: '44444444444',
      totalLimit: 15000,
      availableLimit: 15000
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Limite do cartao de credito atualizado'
      })
    );
  });

  test('adminUpdateCreditLimit - deve retornar 400 se nenhum limite for informado', async () => {
    const req = {
      params: { cpf: '44444444444' },
      body: {},
      user: { cpf: '00000000000', role: 'admin' }
    };

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    await controller.adminUpdateCreditLimit(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Informe totalLimit ou availableLimit.'
    });
  });

  test('adminUpdateCreditLimit - deve retornar 404 se usuario nao for encontrado', async () => {
    const req = {
      params: { cpf: '99999999999' },
      body: { totalLimit: 10000 },
      user: { cpf: '00000000000', role: 'admin' }
    };

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    mockUsersRepo.findByCpf.mockResolvedValueOnce(null);

    await controller.adminUpdateCreditLimit(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Usuario nao encontrado.'
    });
  });
});
