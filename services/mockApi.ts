import { User, Transaction } from '../types';

// ============================================================================================
// ATENÇÃO: ESTE ARQUIVO SIMULA UMA API DE BACKEND
// ============================================================================================
// Em um aplicativo de produção real, este arquivo seria substituído por um cliente de API
// que faz chamadas de rede (fetch/axios) para um servidor (Node.js, Python, Java, etc.).
// O servidor seria o único a ter as credenciais e a lógica para se conectar e
// executar consultas no Databricks.
// Os comentários "REAL BACKEND INTEGRATION" abaixo mostram onde essa lógica do servidor entraria.
// ============================================================================================


const USERS_DB_KEY = 'fintech_users';
const AUTH_TOKEN_KEY = 'fintech_auth_token'; // Chave para o nosso token JWT simulado

// Initialize with some mock data if the DB is empty
const initializeDb = () => {
  if (!localStorage.getItem(USERS_DB_KEY)) {
    const initialUser: User = {
      fullName: 'Cliente Exemplo',
      cpf: '111.111.111-11',
      email: 'cliente@exemplo.com',
      password: 'password123',
      balance: 5000.00,
      transactions: [
        { id: '1', type: 'DEPOSIT', amount: 5000.00, date: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString(), description: 'Depósito inicial' },
        { id: '2', type: 'PIX_SENT', amount: -150.00, date: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString(), description: 'Pagamento Lanchonete', to: 'lanche@exemplo.com' },
        { id: '3', type: 'PIX_RECEIVED', amount: 300.00, date: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(), description: 'Recebido de Amigo', from: 'amigo@exemplo.com' },
      ],
      loginAttempts: 0,
      isBlocked: false,
      pixDailyLimit: 2000,
      passwordResetRequested: false,
    };
    localStorage.setItem(USERS_DB_KEY, JSON.stringify({ [initialUser.cpf]: initialUser }));
  }
};

initializeDb();

const getUsers = (): Record<string, User> => {
  const users = localStorage.getItem(USERS_DB_KEY);
  return users ? JSON.parse(users) : {};
};

const saveUsers = (users: Record<string, User>) => {
  localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
};

// SIMULAÇÃO: Função para obter o cabeçalho de autorização que seria enviado em cada requisição
const getAuthHeader = () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return {};
    return { 'Authorization': `Bearer ${token}` };
};

export const signUp = async (newUser: Omit<User, 'balance' | 'transactions' | 'loginAttempts' | 'isBlocked' | 'pixDailyLimit' | 'passwordResetRequested'>): Promise<{ success: boolean; message: string }> => {
  return new Promise(resolve => {
    // --- REAL BACKEND INTEGRATION ---
    // 1. O frontend faria: `fetch('/api/signup', { method: 'POST', body: JSON.stringify(newUser) })`
    // 2. O backend receberia os dados, validaria, faria HASH da senha e inseriria no Databricks.
    //    SQL: `INSERT INTO fintech.clientes (cpf, fullName, email, password_hash, ...) VALUES (...)`
    // ---------------------------------
    setTimeout(() => {
      const users = getUsers();
      if (users[newUser.cpf] || Object.values(users).some(u => u.email === newUser.email)) {
        resolve({ success: false, message: 'CPF ou E-mail já cadastrado.' });
        return;
      }
      
      const userToSave: User = {
        ...newUser,
        balance: 1000, // Initial bonus
        transactions: [{ id: crypto.randomUUID(), type: 'DEPOSIT', amount: 1000, date: new Date().toISOString(), description: 'Bônus de boas-vindas' }],
        loginAttempts: 0,
        isBlocked: false,
        pixDailyLimit: 2000,
        passwordResetRequested: false,
      };

      users[newUser.cpf] = userToSave;
      saveUsers(users);
      resolve({ success: true, message: 'Conta criada com sucesso!' });
    }, 1000);
  });
};

export const login = async (cpf: string, password_sent: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> => {
  return new Promise(resolve => {
    // --- REAL BACKEND INTEGRATION ---
    // 1. O frontend faria: `fetch('/api/login', { method: 'POST', body: JSON.stringify({ cpf, password_sent }) })`
    // 2. O backend buscaria o usuário no Databricks, compararia a senha com `bcrypt.compare()`.
    // 3. Se a senha for válida, o backend geraria um token JWT: `jwt.sign({ id: user.cpf }, JWT_SECRET)`
    // 4. A resposta da API seria: `{ success: true, token: '...', user: {...} }`
    // ---------------------------------
    setTimeout(() => {
      const users = getUsers();
      let user = users[cpf];
      
      if (!user) {
        resolve({ success: false, message: 'CPF ou senha inválidos.' });
        return;
      }

      if (user.isBlocked) {
        resolve({ success: false, message: 'Sua conta está bloqueada. Por favor, solicite uma nova senha.' });
        return;
      }

      if (user.password === password_sent) {
        user.loginAttempts = 0;
        saveUsers(users);
        const { password, ...userToReturn } = user;
        // Simulação da criação e armazenamento do token JWT
        const fakeJwtToken = `fake-jwt-token-for-${user.cpf}-${Date.now()}`;
        localStorage.setItem(AUTH_TOKEN_KEY, fakeJwtToken);

        resolve({ success: true, message: 'Login bem-sucedido!', user: userToReturn });
      } else {
        user.loginAttempts += 1;
        if (user.loginAttempts >= 3) {
          user.isBlocked = true;
        }
        saveUsers(users);
        const message = user.isBlocked 
            ? 'Conta bloqueada por excesso de tentativas.' 
            : `CPF ou senha inválidos. Tentativas restantes: ${3 - user.loginAttempts}`;
        resolve({ success: false, message });
      }
    }, 1000);
  });
};

export const requestNewPassword = async (cpf: string): Promise<{ success: boolean; message: string }> => {
    // REAL BACKEND: `fetch('/api/request-password-reset', { method: 'POST', body: JSON.stringify({ cpf }) })`
    return new Promise(resolve => {
        setTimeout(() => {
            const users = getUsers();
            const user = users[cpf];
            if (user && user.isBlocked) {
                user.passwordResetRequested = true;
                saveUsers(users);
                resolve({ success: true, message: 'Sua solicitação foi enviada. A equipe de administração entrará em contato.' });
            } else if (user) {
                resolve({ success: false, message: 'Sua conta não está bloqueada.' });
            }
            else {
                resolve({ success: false, message: 'CPF não encontrado.' });
            }
        }, 1000);
    });
};


export const getCurrentUser = (): User | null => {
  // Em uma aplicação real, o frontend não armazena o usuário, apenas o token.
  // A validação do token e a busca dos dados do usuário seriam feitas a cada recarregamento da página.
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return null;
  
  // Simulação: decodificando o token falso para obter o CPF
  const cpf = token.split('-')[4];
  const users = getUsers();
  const user = users[cpf];
  if(user){
      const { password, ...userToReturn } = user;
      return userToReturn;
  }
  return null;
};

export const logoutUser = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const getUserData = async (cpf: string): Promise<User | null> => {
    // --- REAL BACKEND INTEGRATION ---
    // O frontend faria: `fetch('/api/user/data', { headers: getAuthHeader() })`
    // O backend validaria o token JWT e, se válido, buscaria os dados do usuário no Databricks.
    // ---------------------------------
    console.log("Simulando requisição de dados com cabeçalho:", getAuthHeader());
    return new Promise(resolve => {
        setTimeout(() => {
            const users = getUsers();
            const user = users[cpf];
            if (user) {
                const { password, ...userData } = user;
                resolve(userData);
            } else {
                resolve(null);
            }
        }, 500);
    });
};

const isToday = (someDate: Date) => {
    const today = new Date();
    return someDate.getDate() == today.getDate() &&
        someDate.getMonth() == today.getMonth() &&
        someDate.getFullYear() == today.getFullYear();
}

export const getPixDailyUsage = async (cpf: string): Promise<number> => {
    // REAL BACKEND: `fetch('/api/pix/daily-usage', { headers: getAuthHeader() })`
    return new Promise(resolve => {
        const users = getUsers();
        const user = users[cpf];
        if (!user) {
            resolve(0);
            return;
        }
        const todayPixSent = user.transactions
            .filter(t => t.type === 'PIX_SENT' && isToday(new Date(t.date)))
            .reduce((acc, t) => acc + Math.abs(t.amount), 0);
        
        resolve(todayPixSent);
    });
};


export const performPix = async (fromCpf: string, toKey: string, amount: number, description: string): Promise<{ success: boolean; message: string; updatedUser?: User }> => {
    // --- REAL BACKEND INTEGRATION ---
    // `fetch('/api/pix/transfer', { method: 'POST', headers: getAuthHeader(), body: JSON.stringify({ toKey, amount, description }) })`
    // O backend faria toda a lógica transacional segura no Databricks.
    // ---------------------------------
    return new Promise(async resolve => {
        setTimeout(async() => {
            const users = getUsers();
            const fromUser = users[fromCpf];

            if (!fromUser) {
                resolve({ success: false, message: 'Usuário de origem não encontrado.' });
                return;
            }
            if (fromUser.balance < amount) {
                resolve({ success: false, message: 'Saldo insuficiente.' });
                return;
            }
            
            const dailyUsage = await getPixDailyUsage(fromCpf);
            if (dailyUsage + amount > fromUser.pixDailyLimit) {
                resolve({ success: false, message: `Limite diário de PIX excedido. Restante: R$ ${(fromUser.pixDailyLimit - dailyUsage).toFixed(2)}` });
                return;
            }

            let toUser: User | undefined = Object.values(users).find(u => u.cpf === toKey || u.email === toKey);

            if (toUser && toUser.isBlocked) {
                resolve({ success: false, message: 'A conta de destino está bloqueada e não pode receber PIX.' });
                return;
            }

            fromUser.balance -= amount;
            const newTransaction: Transaction = {
                id: crypto.randomUUID(),
                type: 'PIX_SENT',
                amount: -amount,
                date: new Date().toISOString(),
                description: description || `PIX para ${toKey}`,
                to: toKey
            };
            fromUser.transactions.unshift(newTransaction);
            
            if (toUser) {
                toUser.balance += amount;
                const toTransaction: Transaction = {
                    id: crypto.randomUUID(),
                    type: 'PIX_RECEIVED',
                    amount: amount,
                    date: new Date().toISOString(),
                    description: description || `PIX de ${fromUser.fullName}`,
                    from: fromUser.fullName
                };
                toUser.transactions.unshift(toTransaction);
            }
            
            saveUsers(users);
            const { password, ...userToReturn } = fromUser;
            resolve({ success: true, message: 'PIX enviado com sucesso!', updatedUser: userToReturn });
        }, 1500);
    });
};

// --- ADMIN FUNCTIONS ---

export const getAllUsers = async (): Promise<Omit<User, 'password'>[]> => {
    // REAL BACKEND: `fetch('/api/admin/users', { headers: getAuthHeader() })`
    return new Promise(resolve => {
        setTimeout(() => {
            const users = getUsers();
            const usersList = Object.values(users).map(u => {
                const { password, ...user } = u;
                return user;
            });
            resolve(usersList);
        }, 500);
    });
};

export const adminToggleBlockUser = async (cpf: string): Promise<{ success: boolean }> => {
    // REAL BACKEND: `fetch(`/api/admin/users/${cpf}/toggle-block`, { method: 'POST', headers: getAuthHeader() })`
    return new Promise(resolve => {
        const users = getUsers();
        if (users[cpf]) {
            users[cpf].isBlocked = !users[cpf].isBlocked;
            if(!users[cpf].isBlocked){ users[cpf].loginAttempts = 0; }
            saveUsers(users);
            resolve({ success: true });
        } else {
            resolve({ success: false });
        }
    });
};

export const adminUpdateBalance = async (cpf: string, amount: number): Promise<{ success: boolean }> => {
    // REAL BACKEND: `fetch(`/api/admin/users/${cpf}/add-balance`, { method: 'POST', headers: getAuthHeader(), body: JSON.stringify({ amount }) })`
    return new Promise(resolve => {
        const users = getUsers();
        if (users[cpf]) {
            users[cpf].balance += amount;
            const newTransaction: Transaction = {
                id: crypto.randomUUID(),
                type: 'ADMIN_DEPOSIT',
                amount: amount,
                date: new Date().toISOString(),
                description: 'Depósito administrativo'
            };
            users[cpf].transactions.unshift(newTransaction);
            saveUsers(users);
            resolve({ success: true });
        } else {
            resolve({ success: false });
        }
    });
};

export const adminResetPassword = async (cpf: string): Promise<{ success: boolean; newPassword?: string }> => {
    // REAL BACKEND: `fetch(`/api/admin/users/${cpf}/reset-password`, { method: 'POST', headers: getAuthHeader() })`
    return new Promise(resolve => {
        const users = getUsers();
        if (users[cpf]) {
            const newPassword = `nova${Math.floor(1000 + Math.random() * 9000)}`;
            users[cpf].password = newPassword;
            users[cpf].isBlocked = false;
            users[cpf].loginAttempts = 0;
            users[cpf].passwordResetRequested = false;
            saveUsers(users);
            resolve({ success: true, newPassword });
        } else {
            resolve({ success: false });
        }
    });
};