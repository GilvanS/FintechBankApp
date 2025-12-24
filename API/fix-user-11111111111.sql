-- Script para diagnosticar e corrigir o usuário 11111111111
-- Execute este script no seu banco de dados (PostgreSQL ou Databricks)

-- ============================================
-- 1. VERIFICAR STATUS ATUAL DO USUÁRIO
-- ============================================
SELECT 
    cpf,
    full_name,
    email,
    is_blocked,
    login_attempts,
    password_reset_requested,
    CASE 
        WHEN password_hash IS NULL THEN 'NULL'
        WHEN password_hash = '' THEN 'VAZIO'
        ELSE 'DEFINIDO (' || LEFT(password_hash, 20) || '...)'
    END as password_status,
    role,
    balance,
    created_at,
    updated_at
FROM users
WHERE cpf = '11111111111';

-- ============================================
-- 2. VERIFICAR SE O USUÁRIO ESTÁ BLOQUEADO
-- ============================================
-- Se o resultado mostrar is_blocked = true, desbloqueie com:
-- UPDATE users SET is_blocked = false WHERE cpf = '11111111111';

-- ============================================
-- 3. VERIFICAR E RESETAR TENTATIVAS DE LOGIN
-- ============================================
-- Se login_attempts estiver muito alto, resete com:
-- UPDATE users SET login_attempts = 0 WHERE cpf = '11111111111';

-- ============================================
-- 4. CORREÇÕES POSSÍVEIS
-- ============================================

-- A. DESBLOQUEAR USUÁRIO (se estiver bloqueado)
-- UPDATE users 
-- SET is_blocked = false, 
--     updated_at = CURRENT_TIMESTAMP 
-- WHERE cpf = '11111111111';

-- B. RESETAR SENHA PARA 'Senha123' (hash bcrypt)
-- Nota: Este hash é para a senha 'Senha123'
-- Para PostgreSQL:
-- UPDATE users 
-- SET password_hash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
--     login_attempts = 0,
--     password_reset_requested = false,
--     updated_at = CURRENT_TIMESTAMP
-- WHERE cpf = '11111111111';

-- C. CORREÇÃO COMPLETA (desbloquear + resetar senha + resetar tentativas)
-- UPDATE users 
-- SET is_blocked = false,
--     password_hash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
--     login_attempts = 0,
--     password_reset_requested = false,
--     updated_at = CURRENT_TIMESTAMP
-- WHERE cpf = '11111111111';

-- ============================================
-- NOTA: O hash acima pode não ser o correto
-- Para gerar um novo hash, use Node.js:
-- const bcrypt = require('bcryptjs');
-- const hash = bcrypt.hashSync('Senha123', 10);
-- console.log(hash);
-- ============================================
