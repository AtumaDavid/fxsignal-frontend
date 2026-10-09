import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Empty, Spinner } from '../../components/ui/Empty';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { checkoutPlan, getAccount, getPlans } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { AccountInfo, BillingPlan } from '../../lib/types';

export default function Billing() {
  const { patchUser } = useAuth();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getPlans(controller.signal), getAccount(controller.signal)])
      .then(([p, a]) => {
        setPlans(p);
        setAccount(a);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error ? err.message : 'Billing is unavailable.'
          );
      });
    return () => controller.abort();
  }, []);

  const [pendingPlan, setPendingPlan] = useState<'PRO' | 'FREE' | null>(null);

  async function change(plan: 'PRO' | 'FREE') {
    if (plan === 'FREE') {
      setPendingPlan(plan);
      return;
    }
    await applyPlan(plan);
  }

  async function applyPlan(plan: 'PRO' | 'FREE') {
    setBusy(plan);
    setPendingPlan(null);
    setNotice(null);
    try {
      const result = await checkoutPlan(plan);
      setAccount((prev) =>
        prev ? { ...prev, user: result.user, plan: result.plan } : prev
      );
      patchUser({ plan: result.user.plan, planStatus: result.user.planStatus });
      setNotice({ tone: 'success', text: result.message });
    } catch (err) {
      setNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not change plan.',
      });
    } finally {
      setBusy(null);
    }
  }

  const current = account?.plan.id ?? 'FREE';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Plan & billing</h1>
          <p>
            Both plans get every signal and every weekly outlook. Pro adds depth
            to the track record.
          </p>
        </div>
      </div>

      {error ? (
        <div className="panel">
          <Empty icon="card" title="Billing unavailable">
            {error}
          </Empty>
        </div>
      ) : !account ? (
        <div className="panel panel-body">
          <div className="skeleton" style={{ height: 120 }} />
        </div>
      ) : (
        <div className="stack">
          <section
            className="kpis"
            style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
          >
            <div className="kpi">
              <span className="label">Current plan</span>
              <div className="kpi-value">{account.plan.name}</div>
              <span className="kpi-note">
                Status: {account.user.planStatus?.toLowerCase() ?? 'active'}
              </span>
            </div>
            <div className="kpi">
              <span className="label">History depth</span>
              <div className="kpi-value">
                {account.plan.limits.historyDays}
                <small>days</small>
              </div>
              <span className="kpi-note">
                Up to {account.plan.limits.historyLimit} rows per query
              </span>
            </div>
            <div className="kpi">
              <span className="label">Engine record</span>
              <div className="kpi-value">
                {account.usage.hits}
                <small>/ {account.usage.hits + account.usage.misses}</small>
              </div>
              <span className="kpi-note">
                Targets reached of scored trades, all time
              </span>
            </div>
          </section>

          {notice && (
            <div className={`alert alert-${notice.tone}`} role="status">
              <Icon
                name={notice.tone === 'success' ? 'check' : 'info'}
                size={14}
              />
              {notice.text}
            </div>
          )}

          <div className="plans">
            {plans.map((plan) => {
              const isCurrent = plan.id === current;
              return (
                <div className="plan" key={plan.id}>
                  <div className="plan-name">
                    {plan.name}
                    {isCurrent && <span className="tag">Current</span>}
                  </div>
                  <div className="plan-price">
                    <strong>{plan.price}</strong>
                    <span>{plan.cadence}</span>
                  </div>
                  <p>{plan.blurb}</p>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Icon name="check" size={14} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={`btn btn-lg ${plan.id === 'PRO' && !isCurrent ? 'btn-primary' : 'btn-secondary'}`}
                    disabled={isCurrent || busy !== null}
                    onClick={() =>
                      void change(plan.id === 'PRO' ? 'PRO' : 'FREE')
                    }
                  >
                    {busy === plan.id && <Spinner />}
                    {isCurrent
                      ? 'Your plan'
                      : plan.id === 'PRO'
                        ? 'Upgrade to Pro'
                        : 'Switch to Free'}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="disclaimer">
            <Icon name="info" size={14} />
            Checkout is simulated in this build: plan changes apply immediately
            and no card is charged. Connect Stripe in the API before taking real
            payments.
          </p>
        </div>
      )}

      {pendingPlan === 'FREE' && (
        <ConfirmModal
          title="Move to the Free plan?"
          message="Your signal history drops to 7 days. Your journal trades are kept, but older signals fall outside the history window."
          confirmLabel="Switch to Free"
          danger
          busy={busy === 'FREE'}
          onCancel={() => setPendingPlan(null)}
          onConfirm={() => void applyPlan('FREE')}
        />
      )}
    </>
  );
}
