import { User, Transaction } from '../types';

const USERS_DB_KEY = 'fintech_users';
const CURRENT_USER_KEY = 'fintech_current_user';

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

export const signUp = async (newUser: Omit<User, 'balance' | 'transactions' | 'loginAttempts' | 'isBlocked' | 'pixDailyLimit' | 'passwordResetRequested'>): Promise<{ success: boolean; message: string }> => {
  return new Promise(resolve => {
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
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userToReturn));
        resolve({ success: true, message: 'Login bem-sucedido!', user: userToReturn });
      } else {
        user.loginAttempts += 1;
        if (user.loginAttempts >= 3) {
          user.isBlocked = true;
          saveUsers(users);
          resolve({ success: false, message: 'Conta bloqueada por excesso de tentativas.' });
        } else {
          saveUsers(users);
          resolve({ success: false, message: `CPF ou senha inválidos. Tentativas restantes: ${3 - user.loginAttempts}` });
        }
      }
    }, 1000);
  });
};

export const requestNewPassword = async (cpf: string): Promise<{ success: boolean; message: string }> => {
    return new Promise(resolve => {
        setTimeout(() => {
            const users = getUsers();
            const user = users[cpf];
            if (user && user.isBlocked) {
                user.passwordResetRequested = true;
                saveUsers(users);
                console.log(`ALERTA ADMIN: Solicitação de nova senha para o CPF ${cpf}.`);
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
  const user = localStorage.getItem(CURRENT_USER_KEY);
  return user ? JSON.parse(user) : null;
};

export const logoutUser = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const getUserData = async (cpf: string): Promise<User | null> => {
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
            
            // Daily Limit Check
            const dailyUsage = await getPixDailyUsage(fromCpf);
            if (dailyUsage + amount > fromUser.pixDailyLimit) {
                resolve({ success: false, message: `Limite diário de PIX excedido. Restante: R$ ${(fromUser.pixDailyLimit - dailyUsage).toFixed(2)}` });
                return;
            }

            let toUser: User | undefined = Object.values(users).find(u => u.cpf === toKey || u.email === toKey);

            // Blocked User Check
            if (toUser && toUser.isBlocked) {
                resolve({ success: false, message: 'A conta de destino está bloqueada e não pode receber PIX.' });
                return;
            }

            if (!toUser) {
                 // Simulate transfer to external account
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
                saveUsers(users);
                const { password, ...userToReturn } = fromUser;
                localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userToReturn));
                resolve({ success: true, message: 'PIX enviado com sucesso!', updatedUser: userToReturn });
                return;
            }

            fromUser.balance -= amount;
            toUser.balance += amount;

            const fromTransaction: Transaction = {
                id: crypto.randomUUID(),
                type: 'PIX_SENT',
                amount: -amount,
                date: new Date().toISOString(),
                description: description || `PIX para ${toUser.fullName}`,
                to: toUser.fullName
            };
            fromUser.transactions.unshift(fromTransaction);

            const toTransaction: Transaction = {
                id: crypto.randomUUID(),
                type: 'PIX_RECEIVED',
                amount: amount,
                date: new Date().toISOString(),
                description: description || `PIX de ${fromUser.fullName}`,
                from: fromUser.fullName
            };
            toUser.transactions.unshift(toTransaction);

            saveUsers(users);
            const { password, ...userToReturn } = fromUser;
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userToReturn));
            resolve({ success: true, message: 'PIX enviado com sucesso!', updatedUser: userToReturn });
        }, 1500);
    });
};

// --- ADMIN FUNCTIONS ---

export const getAllUsers = async (): Promise<Omit<User, 'password'>[]> => {
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
    return new Promise(resolve => {
        const users = getUsers();
        if (users[cpf]) {
            users[cpf].isBlocked = !users[cpf].isBlocked;
            if(!users[cpf].isBlocked){ // also reset attempts if unblocking
                users[cpf].loginAttempts = 0;
            }
            saveUsers(users);
            resolve({ success: true });
        } else {
            resolve({ success: false });
        }
    });
};

export const adminUpdateBalance = async (cpf: string, amount: number): Promise<{ success: boolean }> => {
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