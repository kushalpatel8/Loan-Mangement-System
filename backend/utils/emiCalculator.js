// Calculates monthly EMI: E = P * r * (1 + r)^n / ((1 + r)^n - 1)
export const calculateMonthlyEmi = (principal, annualInterestRate, tenureMonths) => {
  const P = Number(principal) || 0
  const n = Number(tenureMonths) || 1
  const r = (Number(annualInterestRate) || 0) / 12 / 100

  if (P <= 0 || n <= 0) return 0
  if (r === 0) return Math.round(P / n)

  const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  return Math.round(emi)
}

// Generates complete amortization table for all installments
export const generateAmortizationSchedule = (principal, annualInterestRate, tenureMonths, startDate = new Date()) => {
  const P = Number(principal) || 0
  const n = Number(tenureMonths) || 1
  const r = (Number(annualInterestRate) || 0) / 12 / 100
  const emi = calculateMonthlyEmi(P, annualInterestRate, n)

  let balance = P
  const installments = []
  const baseDate = new Date(startDate)

  for (let i = 1; i <= n; i++) {
    const dueDate = new Date(baseDate)
    dueDate.setMonth(baseDate.getMonth() + i)

    const interestComponent = Math.round(balance * r)
    let principalComponent = emi - interestComponent

    if (i === n || principalComponent > balance) {
      principalComponent = balance
    }

    balance = Math.max(0, balance - principalComponent)

    installments.push({
      installmentNumber: i,
      dueDate,
      emiAmount: principalComponent + interestComponent,
      principalComponent,
      interestComponent,
      remainingPrincipal: balance,
      status: "pending"
    })
  }

  const totalInterest = installments.reduce((acc, curr) => acc + curr.interestComponent, 0)
  const totalAmountPayable = P + totalInterest

  return {
    monthlyEmi: emi,
    totalPrincipal: P,
    totalInterest,
    totalAmountPayable,
    installments
  }
}

export default {
  calculateMonthlyEmi,
  generateAmortizationSchedule
}
