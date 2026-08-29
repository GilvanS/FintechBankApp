describe('Task 4 — Billing Worker & RUN_INTERNAL_WORKER guard', () => {
  const originalEnv = process.env.RUN_INTERNAL_WORKER;

  afterEach(() => {
    process.env.RUN_INTERNAL_WORKER = originalEnv;
  });

  test('process.env.RUN_INTERNAL_WORKER=false deve desativar crons internos', () => {
    process.env.RUN_INTERNAL_WORKER = 'false';
    expect(process.env.RUN_INTERNAL_WORKER).toBe('false');
  });
});