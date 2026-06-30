import re

def fix_homeview():
    target_path = r'F:\GITHUB\FintechBankApp\WEB\components\HomeView.tsx'
    
    with open(target_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add missing imports
    if ' Trash2 ' not in content:
        content = re.sub(r'import { (.*?)} from \'lucide-react\';', 
                         lambda m: f"import {{ {m.group(1)}, Trash2, Plus }} from 'lucide-react';", content, count=1)

    # 2. Add missing state variables at the beginning of the component
    state_injection = """
  const [isFinancialHealthOpen, setIsFinancialHealthOpen] = useState(false);
  const [isAiRecurringModalOpen, setIsAiRecurringModalOpen] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null);
  const [isAddingBill, setIsAddingBill] = useState(false);
  
  const [newBillTitle, setNewBillTitle] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newBillCategory, setNewBillCategory] = useState<'refeicao' | 'mobilidade' | 'cultura' | 'saude' | 'outros'>('outros');
  const [newBillDueDate, setNewBillDueDate] = useState('');

  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const handleDeleteRecurringBill = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recurringBills.filter(b => b.id !== id);
    setRecurringBills(updated);
    localStorage.setItem('volt_recurring_bills', JSON.stringify(updated));
  };
"""
    if 'const [isFinancialHealthOpen' not in content:
        content = content.replace('const [isBiometricOpen, setIsBiometricOpen] = useState(false);',
                                  'const [isBiometricOpen, setIsBiometricOpen] = useState(false);\n' + state_injection)

    # 3. Handle specific missing properties or handlers if necessary
    calc_injection = """
  const totalEstimatedMonthly = recurringBills.reduce((acc, curr) => acc + curr.amount, 0);
  const totalPaidUpcoming = recurringBills.filter(b => b.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
  const totalPendingUpcoming = recurringBills.filter(b => b.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0);
"""
    if 'const totalEstimatedMonthly' not in content:
        content = content.replace('const [searchQuery, setSearchQuery] = useState(\'\');',
                                  calc_injection + '\n  const [searchQuery, setSearchQuery] = useState(\'\');')

    # 4. Handle globalDialog
    content = content.replace('globalDialog.show', 'showDialog')

    # 5. Fix `handleAddRecurringBill`
    add_bill_injection = """
  const handleAddRecurringBill = () => {
    if (!newBillTitle || !newBillAmount || !newBillDueDate) {
      showDialog({ title: 'Erro', message: 'Preencha todos os campos.' });
      return;
    }
    const newBill: RecurringBill = {
      id: `rec_${Date.now()}`,
      title: newBillTitle,
      amount: -Math.abs(parseFloat(newBillAmount)),
      category: newBillCategory,
      dueDate: newBillDueDate,
      status: 'pending'
    };
    const updated = [...recurringBills, newBill];
    setRecurringBills(updated);
    localStorage.setItem('volt_recurring_bills', JSON.stringify(updated));
    setIsAddingBill(false);
    setNewBillTitle('');
    setNewBillAmount('');
    setNewBillDueDate('');
  };
"""
    if 'const handleAddRecurringBill' not in content:
        content = content.replace('const handleSaveGoal = () => {', add_bill_injection + '\n  const handleSaveGoal = () => {')

    with open(target_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Injections complete for HomeView.tsx")

if __name__ == '__main__':
    fix_homeview()