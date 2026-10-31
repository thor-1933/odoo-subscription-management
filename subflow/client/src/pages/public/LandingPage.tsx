import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  CircleHelp,
  FileCheck2,
  FileText,
  Menu,
  ReceiptText,
  Repeat2,
  ShieldCheck,
  X,
} from 'lucide-react';

type DemoRole = 'ADMIN' | 'STAFF' | 'CUSTOMER';

const navigation = [
  { label: 'Product', href: '#product' },
  { label: 'Workflow', href: '#workflow' },
  { label: 'Roles', href: '#roles' },
  { label: 'FAQ', href: '#faq' },
];

const roleOptions: { role: DemoRole; title: string; description: string }[] = [
  {
    role: 'ADMIN',
    title: 'Admin workspace',
    description: 'Revenue oversight, configuration, team access, and billing controls.',
  },
  {
    role: 'STAFF',
    title: 'Staff workspace',
    description: 'Daily customer operations across quotations, subscriptions, and invoices.',
  },
  {
    role: 'CUSTOMER',
    title: 'Customer portal',
    description: 'A clear self-service view of plans, contracts, invoices, and payments.',
  },
];

const faqItems = [
  {
    question: 'How does recurring billing work?',
    answer:
      'Subscriptions use their configured billing frequency and next billing date. The billing engine creates invoices for due periods and advances the next date while preventing duplicate invoices for the same period.',
  },
  {
    question: 'Is GST supported?',
    answer:
      'Yes. Tax rules can be configured and applied to quotations and invoices. Invoice line items retain the applicable tax breakdown.',
  },
  {
    question: 'Can customers pay online?',
    answer:
      'SubFlow records and reconciles payments against invoices. Payment capture is not an online checkout flow; payment entries are recorded by staff or through the configured operations workflow.',
  },
  {
    question: 'Which payment channels are tracked?',
    answer:
      'Payment records support UPI, bank transfer, credit card, debit card, cash, and other as payment methods.',
  },
  {
    question: 'Is customer data isolated?',
    answer:
      'Customer-facing API access is scoped to the signed-in customer, while staff and administrators use role-based access to operational records.',
  },
  {
    question: "What is Odoo's role?",
    answer:
      'SubFlow is the subscription and recurring-revenue management application built for the Odoo × Make-A-Ton 9.0 hackathon. Product, subscription, invoice, payment, and analytics workflows are available in the app.',
  },
];

const roles: {
  role: DemoRole;
  title: string;
  description: string;
  previewLabel: string;
  previewItems: string[];
}[] = [
  {
    role: 'ADMIN',
    title: 'See the whole revenue picture.',
    description:
      'Monitor recurring revenue and receivables, manage billing rules, and keep teams and catalog settings in order.',
    previewLabel: 'Management overview',
    previewItems: ['Revenue analytics', 'Billing controls', 'Team & rules'],
  },
  {
    role: 'STAFF',
    title: 'Move customer work forward.',
    description:
      'Draft quotations, convert accepted work into subscriptions, issue invoices, and reconcile payments.',
    previewLabel: 'Operations workspace',
    previewItems: ['Quotation pipeline', 'Subscription lifecycle', 'Invoice processing'],
  },
  {
    role: 'CUSTOMER',
    title: 'Give every customer a clear view.',
    description:
      'Offer a focused portal for active subscriptions, available plans, invoice documents, payment history, and profile details.',
    previewLabel: 'Customer portal',
    previewItems: ['My subscriptions', 'Invoices & PDFs', 'Payment history'],
  },
];

const productFeatures = [
  {
    id: 'catalog',
    number: '01',
    eyebrow: 'Catalog & pricing',
    title: 'A product catalog that carries its logic forward.',
    description:
      'Define products, variants, and price adjustments once. The configured price carries into quotations, subscriptions, and invoices.',
    visual: (
      <div className="lp-preview lp-catalog" aria-label="Illustrative product variant pricing preview">
        <div className="lp-preview-topline">
          <span>PRODUCT / SOFTWARE</span>
          <span className="lp-mono">SKU · BL-ERP-01</span>
        </div>
        <div className="lp-catalog-title">
          <div>
            <p className="lp-label">Brightloop Business</p>
            <p className="lp-muted">Subscription platform · Monthly</p>
          </div>
          <span className="lp-live-state"><i /> Active</span>
        </div>
        <div className="lp-price-line"><span>Base price</span><strong>₹1,000.00</strong></div>
        <div className="lp-price-line"><span>Odoo edition</span><strong>+ ₹560.00</strong></div>
        <div className="lp-rule" />
        <div className="lp-price-line lp-price-total"><span>Effective price</span><strong>₹1,560.00</strong></div>
      </div>
    ),
  },
  {
    id: 'quotations',
    number: '02',
    eyebrow: 'Sales to subscription',
    title: 'Turn an accepted quotation into the next chapter.',
    description:
      'Keep the path from offer to contract connected. Convert accepted quotations into active subscriptions with billing dates in place.',
    visual: (
      <div className="lp-preview lp-quote" aria-label="Illustrative quotation conversion preview">
        <div className="lp-preview-topline">
          <span>QUOTATION · Q-2026-0148</span>
          <span className="lp-status lp-status-green">Accepted</span>
        </div>
        <div className="lp-quote-title">
          <div>
            <p className="lp-label">Acme Studio</p>
            <p className="lp-muted">Business plan · Monthly</p>
          </div>
          <strong>₹8,900.00</strong>
        </div>
        <div className="lp-stepper" aria-label="Quotation workflow: Draft, Sent, Accepted, Subscription">
          <span className="done"><i>✓</i><small>Draft</small></span>
          <span className="done"><i>✓</i><small>Sent</small></span>
          <span className="done"><i>✓</i><small>Accepted</small></span>
          <span><i>4</i><small>Subscription</small></span>
        </div>
        <div className="lp-convert-row"><FileCheck2 size={16} /><span>Ready to convert</span><ArrowRight size={15} /></div>
      </div>
    ),
  },
  {
    id: 'invoices',
    number: '03',
    eyebrow: 'Invoices & receivables',
    title: 'See what is due, paid, and worth following up.',
    description:
      'Keep invoice status, due dates, outstanding balance, and generated PDF documents close at hand for timely action.',
    visual: (
      <div className="lp-preview lp-invoices" aria-label="Illustrative invoice list with statuses">
        <div className="lp-preview-topline"><span>INVOICE REGISTER</span><span className="lp-mono">3 records</span></div>
        <div className="lp-table-head"><span>INVOICE</span><span>CUSTOMER</span><span>DUE</span><span>STATUS</span></div>
        {[
          ['INV-2026-1042', 'Acme Studio', 'Today', 'Due'],
          ['INV-2026-1041', 'Northstar Co.', 'Oct 28', 'Overdue'],
          ['INV-2026-1040', 'Fieldwork Ltd.', 'Oct 25', 'Paid'],
        ].map(([invoice, customer, due, status]) => (
          <div className="lp-table-row" key={invoice}>
            <span className="lp-mono">{invoice}</span><span>{customer}</span><span>{due}</span>
            <span className={`lp-status-dot lp-status-${status.toLowerCase()}`}><i />{status}</span>
          </div>
        ))}
        <div className="lp-aging"><span>Overdue ageing</span><span className="lp-aging-bar"><i /></span><strong>1 invoice</strong></div>
      </div>
    ),
  },
  {
    id: 'payments',
    number: '04',
    eyebrow: 'Payment ledger',
    title: 'Reconcile every payment against the balance.',
    description:
      'Record partial or full payments, track the payment method, and follow the invoice balance through to settlement.',
    visual: (
      <div className="lp-preview lp-ledger" aria-label="Illustrative payment ledger">
        <div className="lp-preview-topline"><span>PAYMENT LEDGER</span><span className="lp-status lp-status-green">Reconciled</span></div>
        <div className="lp-ledger-total"><div><p className="lp-muted">Invoice balance</p><strong>₹1,840.80</strong></div><ArrowDownRight size={19} /></div>
        <div className="lp-ledger-entry"><span className="lp-ledger-mark">01</span><div><strong>UPI payment</strong><small>Oct 29 · Ref. ending 4821</small></div><b>− ₹1,000.00</b></div>
        <div className="lp-ledger-entry"><span className="lp-ledger-mark">02</span><div><strong>Bank transfer</strong><small>Oct 30 · Balance settled</small></div><b>− ₹840.80</b></div>
        <div className="lp-settled"><Check size={14} /> Outstanding balance <strong>₹0.00</strong></div>
      </div>
    ),
  },
  {
    id: 'analytics',
    number: '05',
    eyebrow: 'Revenue analytics',
    title: 'Make recurring revenue easier to read.',
    description:
      'Review MRR and ARR, collected revenue, outstanding receivables, and trends from the transactions in your system.',
    visual: (
      <div className="lp-preview lp-analytics" aria-label="Illustrative recurring revenue analytics">
        <div className="lp-preview-topline"><span>REVENUE OVERVIEW</span><span className="lp-mono">TRAILING 6 MONTHS</span></div>
        <div className="lp-analytics-numbers">
          <div><small>MRR</small><strong>₹24,80,000.00</strong></div>
          <div><small>ARR</small><strong>₹2,97,60,000.00</strong></div>
        </div>
        <svg className="lp-chart" viewBox="0 0 540 150" role="img" aria-label="Illustrative upward revenue trend chart">
          <path className="lp-chart-grid" d="M0 30H540M0 70H540M0 110H540" />
          <path className="lp-chart-area" d="M0 119 C45 114 60 100 104 104 S160 96 205 87 S266 90 310 66 S370 76 411 51 S485 49 540 20 V150 H0Z" />
          <path className="lp-chart-line" d="M0 119 C45 114 60 100 104 104 S160 96 205 87 S266 90 310 66 S370 76 411 51 S485 49 540 20" />
          <circle cx="540" cy="20" r="5" />
        </svg>
        <div className="lp-chart-months"><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span></div>
      </div>
    ),
  },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('product');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const roleDialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const sections = navigation
      .map(({ href }) => document.querySelector(href))
      .filter((section): section is Element => section !== null);
    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { rootMargin: '-24% 0px -62% 0px', threshold: [0, 0.2, 0.5] }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const revealTargets = document.querySelectorAll('.lp-reveal, .lp-timeline');
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealTargets.forEach((target) => revealObserver.observe(target));
    return () => revealObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!rolePickerOpen) return undefined;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const firstButton = roleDialogRef.current?.querySelector<HTMLElement>('button');
    firstButton?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRolePickerOpen(false);
      if (event.key === 'Tab' && roleDialogRef.current) {
        const focusable = Array.from(
          roleDialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = '';
      previouslyFocused?.focus();
    };
  }, [rolePickerOpen]);

  const chooseRole = (role: DemoRole) => {
    setRolePickerOpen(false);
    navigate('/login', { state: { demoRole: role } });
  };

  const openRolePicker = () => {
    setMobileMenuOpen(false);
    setRolePickerOpen(true);
  };

  return (
    <div className="landing-page min-h-screen bg-[#f3efe8] text-[#12201d]">
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <Link to="/" className="lp-brand" aria-label="SubFlow home">
            <span className="lp-brand-mark">S</span>
            <span>SubFlow</span>
          </Link>
          <nav className="lp-desktop-links" aria-label="Main navigation">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={activeSection === item.href.slice(1) ? 'active' : ''}
                aria-current={activeSection === item.href.slice(1) ? 'location' : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="lp-nav-actions">
            <Link to="/login" className="lp-nav-signin">Sign in</Link>
            <button type="button" className="lp-button lp-button-dark lp-nav-demo" onClick={openRolePicker}>Launch demo</button>
            <button
              type="button"
              className="lp-menu-toggle"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-expanded={mobileMenuOpen}
              aria-controls="lp-mobile-menu"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <nav className="lp-mobile-menu" id="lp-mobile-menu" aria-label="Mobile navigation">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={activeSection === item.href.slice(1) ? 'active' : ''}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}<ArrowRight size={15} />
              </a>
            ))}
            <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Sign in</Link>
            <Link to="/register" onClick={() => setMobileMenuOpen(false)}>Create account</Link>
          </nav>
        )}
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <h1 className="lp-display">Recurring revenue,<br /><em>beautifully</em> in order.</h1>
            <p className="lp-hero-description">
              Quotations, recurring invoices, GST, payments, and analytics—connected in one clear subscription billing workspace.
            </p>
            <div className="lp-hero-actions">
              <button type="button" className="lp-button lp-button-dark" onClick={openRolePicker}>
                Launch live demo <ArrowUpRight size={17} />
              </button>
              <Link to="/register" className="lp-button lp-button-outline">
                Create customer account <ArrowRight size={16} />
              </Link>
            </div>
                      </div>

          <div className="lp-hero-art" aria-label="Illustrative SubFlow revenue dashboard">
            <div className="lp-art-note">Illustrative workspace · sample figures</div>
            <div className="lp-dashboard-window">
              <div className="lp-window-bar">
                <div className="lp-window-brand"><span className="lp-mini-mark">S</span><b>SubFlow</b></div>
                <div className="lp-window-user"><span>Revenue workspace</span><i /></div>
              </div>
              <div className="lp-dashboard-content">
                <div className="lp-dashboard-heading">
                  <div><small>MONDAY, OCTOBER 31</small><h2>Revenue overview</h2></div>
                  <span className="lp-period">Last 6 months <ChevronDown size={13} /></span>
                </div>
                <div className="lp-stat-row">
                  <div className="lp-stat-primary"><small>MONTHLY RECURRING REVENUE</small><strong>₹24,80,000.00</strong><span><ArrowUpRight size={13} /> Period overview</span></div>
                  <div className="lp-stat-secondary"><small>ACTIVE CONTRACTS</small><strong>124</strong><span>Across customer accounts</span></div>
                  <div className="lp-stat-secondary"><small>OUTSTANDING</small><strong>₹2,84,750.00</strong><span>Open invoice balance</span></div>
                </div>
                <div className="lp-dashboard-grid">
                  <div className="lp-chart-panel">
                    <div className="lp-panel-title"><div><b>Revenue trend</b><small>Recurring and collected revenue</small></div><BarChart3 size={16} /></div>
                    <svg className="lp-hero-chart" viewBox="0 0 440 150" role="img" aria-label="Illustrative revenue trend chart">
                      <path className="lp-chart-grid" d="M0 24H440M0 62H440M0 100H440M0 138H440" />
                      <path className="lp-chart-area" d="M0 119 C39 110 56 119 92 101 S149 93 183 84 S237 91 272 63 S327 74 357 47 S405 53 440 18 V150 H0Z" />
                      <path className="lp-chart-line" d="M0 119 C39 110 56 119 92 101 S149 93 183 84 S237 91 272 63 S327 74 357 47 S405 53 440 18" />
                      <circle cx="440" cy="18" r="4.5" />
                    </svg>
                    <div className="lp-chart-months"><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span></div>
                  </div>
                  <div className="lp-billing-panel">
                    <div className="lp-panel-title"><div><b>Billing cadence</b><small>Plans by frequency</small></div><Repeat2 size={15} /></div>
                    {[
                      ['Monthly', '68%', '68%'],
                      ['Yearly', '21%', '47%'],
                      ['Weekly', '8%', '30%'],
                      ['Daily', '3%', '17%'],
                    ].map(([label, percent, width]) => (
                      <div className="lp-cadence" key={label}><span>{label}</span><i><b style={{ width }} /></i><strong>{percent}</strong></div>
                    ))}
                  </div>
                </div>
                <div className="lp-invoice-panel">
                  <div className="lp-panel-title"><div><b>Recent invoices</b><small>Billing activity</small></div><span className="lp-view-link">View ledger <ArrowRight size={13} /></span></div>
                  <div className="lp-invoice-head"><span>INVOICE</span><span>CUSTOMER</span><span>AMOUNT</span><span>STATUS</span></div>
                  {[
                    ['INV-1042', 'Acme Studio', '₹8,900.00', 'Due'],
                    ['INV-1041', 'Northstar Co.', '₹12,400.00', 'Paid'],
                  ].map(([invoice, customer, amount, status]) => (
                    <div className="lp-invoice-row" key={invoice}>
                      <span className="lp-mono">{invoice}</span><span>{customer}</span><strong>{amount}</strong>
                      <span className={`lp-invoice-status ${status.toLowerCase()}`}><i />{status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <span className="lp-art-index">01 — REVENUE, IN PERSPECTIVE</span>
          </div>
        </section>

        <section className="lp-proof" aria-label="Product capabilities">
          <div className="lp-proof-label">The operating details</div>
          <div className="lp-proof-items">
            <div><strong>4</strong><span>billing frequencies</span></div>
            <div><strong>GST</strong><span>tax-ready invoices</span></div>
            <div><strong>3</strong><span>role experiences</span></div>
            <div><strong>PDF</strong><span>invoice downloads</span></div>
            <div><strong>6</strong><span>payment methods tracked</span></div>
          </div>
        </section>

        <section className="lp-product-section" id="product">
          <div className="lp-section-intro">
            <p className="lp-kicker">Product, end to end</p>
            <h2 className="lp-display lp-section-display">One revenue lifecycle.<br /><em>Every detail connected.</em></h2>
            <p>Designed for the real handoffs behind subscription businesses—not just the headline metric.</p>
          </div>
          <div className="lp-feature-list">
            {productFeatures.map((feature, index) => (
              <article className={`lp-feature lp-reveal ${index % 2 ? 'reverse' : ''}`} key={feature.id}>
                <div className="lp-feature-copy">
                  <span className="lp-feature-number">{feature.number}</span>
                  <p className="lp-kicker">{feature.eyebrow}</p>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <a href="#workflow" className="lp-text-link">See the workflow <ArrowRight size={15} /></a>
                </div>
                <div className="lp-feature-visual">{feature.visual}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-workflow-section" id="workflow">
          <div className="lp-workflow-heading">
            <div>
              <p className="lp-kicker">A connected workflow</p>
              <h2 className="lp-display">From first quote<br />to a settled balance.</h2>
            </div>
            <p>Keep the customer and the financial record in view at every step.</p>
          </div>
          <div className="lp-timeline">
            {[
              { number: '01', title: 'Catalog', text: 'Configure product, variant, and price.', icon: <ReceiptText size={17} /> },
              { number: '02', title: 'Quotation', text: 'Prepare an offer with clear terms.', icon: <FileText size={17} /> },
              { number: '03', title: 'Recurring billing', text: 'Generate invoices for due periods.', icon: <Repeat2 size={17} /> },
              { number: '04', title: 'Reconciliation', text: 'Record payment and settle balance.', icon: <Check size={17} /> },
            ].map((step) => (
              <div className="lp-timeline-step lp-reveal" key={step.number}>
                <div className="lp-timeline-marker">{step.icon}</div>
                <span>{step.number} / FLOW</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-tax-band">
          <div className="lp-tax-copy">
            <p className="lp-kicker">The arithmetic matters</p>
            <h2 className="lp-display">Tax, discounts<br />and recurring logic.</h2>
            <p>Make every line legible—from configured product price to tax and final invoice total. Built with decimal-safe financial calculations.</p>
            <div className="lp-tax-note"><ShieldCheck size={16} /> Clear breakdowns. Consistent totals.</div>
          </div>
          <div className="lp-tax-document" aria-label="Illustrative GST invoice calculation">
            <div className="lp-doc-top"><div><span className="lp-doc-mark">S</span><strong>SUBFLOW</strong></div><span>INVOICE PREVIEW</span></div>
            <div className="lp-doc-meta"><div><small>DOCUMENT</small><strong>INV-2026-1042</strong></div><div><small>BILLING PERIOD</small><strong>01 — 30 OCT 2026</strong></div></div>
            <div className="lp-doc-product"><div><strong>Business subscription</strong><small>Odoo edition · Monthly</small></div><strong>₹1,560.00</strong></div>
            <div className="lp-doc-calc"><div><span>Subtotal</span><b>₹1,560.00</b></div><div><span>Discount</span><b>− ₹0.00</b></div><div><span>GST · 18%</span><b>₹280.80</b></div></div>
            <div className="lp-doc-total"><span>Total due</span><strong>₹1,840.80</strong></div>
            <p className="lp-doc-foot">Illustrative calculation · Tax rules are configurable</p>
          </div>
        </section>

        <section className="lp-roles-section" id="roles">
          <div className="lp-roles-heading">
            <p className="lp-kicker">Designed around the work</p>
            <h2 className="lp-display">Three roles.<br /><em>One shared record.</em></h2>
            <p>Give every team member the right view without losing the connection between customer activity and revenue operations.</p>
          </div>
          <div className="lp-role-grid">
            {roles.map((item) => (
              <article className="lp-role-card lp-reveal" key={item.role}>
                <div className={`lp-role-preview lp-role-${item.role.toLowerCase()}`}>
                  <div className="lp-role-preview-head"><span className="lp-mini-mark">S</span><span>{item.previewLabel}</span><i /></div>
                  <div className="lp-role-preview-body">
                    {item.previewItems.map((previewItem, index) => (
                      <div key={previewItem}><span className="lp-role-preview-index">0{index + 1}</span><span>{previewItem}</span><ArrowRight size={12} /></div>
                    ))}
                  </div>
                </div>
                <p className="lp-role-name">{item.role}</p>
                <h3>{item.title}</h3>
                <p className="lp-role-description">{item.description}</p>
                <button className="lp-role-try" type="button" onClick={openRolePicker}>Try as {item.role.toLowerCase()} <ArrowRight size={15} /></button>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-faq-section" id="faq">
          <div className="lp-faq-intro">
            <p className="lp-kicker">Good to know</p>
            <h2 className="lp-display">Questions,<br /><em>answered clearly.</em></h2>
            <p>Want to see the product in action?</p>
            <button type="button" className="lp-text-link" onClick={openRolePicker}>Choose a workspace <ArrowRight size={15} /></button>
          </div>
          <div className="lp-faq-list">
            {faqItems.map((item) => (
              <details key={item.question}>
                <summary>{item.question}<ChevronDown size={17} /></summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-closing">
          <p className="lp-kicker">A more composed way to bill</p>
          <h2 className="lp-display">Let recurring revenue<br /><em>run in rhythm.</em></h2>
          <p>Bring subscriptions, invoices, payments, and insight into one connected workspace.</p>
          <div className="lp-hero-actions">
            <button type="button" className="lp-button lp-button-paper" onClick={openRolePicker}>Launch live demo <ArrowUpRight size={17} /></button>
            <Link to="/register" className="lp-button lp-button-dark-outline">Create customer account <ArrowRight size={16} /></Link>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer-main">
          <div className="lp-footer-brand">
            <Link to="/" className="lp-brand"><span className="lp-brand-mark">S</span><span>SubFlow</span></Link>
            <p>Subscription billing, made legible.</p>
            <span className="lp-footer-event">Made for Odoo × Make-A-Ton 9.0</span>
          </div>
          <div className="lp-footer-column"><h2>Product</h2><a href="#product">Platform</a><a href="#workflow">Workflow</a><a href="#roles">Roles</a><a href="#faq">FAQ</a></div>
          <div className="lp-footer-column"><h2>Workspaces</h2><button type="button" onClick={() => chooseRole('ADMIN')}>Admin</button><button type="button" onClick={() => chooseRole('STAFF')}>Staff</button><button type="button" onClick={() => chooseRole('CUSTOMER')}>Customer</button></div>
          <div className="lp-footer-column"><h2>Account</h2><Link to="/login">Sign in</Link><Link to="/register">Register</Link><a href="mailto:support@brightloop.io">Contact support</a></div>
        </div>
        <div className="lp-footer-bottom"><span>© {new Date().getFullYear()} Brightloop Software</span><span>Built for thoughtful subscription operations.</span></div>
      </footer>

      {rolePickerOpen && (
        <div className="lp-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setRolePickerOpen(false);
        }}>
          <section ref={roleDialogRef} className="lp-role-dialog" role="dialog" aria-modal="true" aria-labelledby="lp-dialog-title">
            <button type="button" className="lp-dialog-close" onClick={() => setRolePickerOpen(false)} aria-label="Close role picker"><X size={19} /></button>
            <p className="lp-kicker">Choose a perspective</p>
            <h2 id="lp-dialog-title">Which workspace would you like to explore?</h2>
            <p className="lp-dialog-copy">Choose a workspace to open its sign-in form. No account details are stored or prefilled here.</p>
            <div className="lp-dialog-roles">
              {roleOptions.map(({ role, title, description }) => (
                <button type="button" key={role} onClick={() => chooseRole(role)}>
                  <span><strong>{title}</strong><small>{description}</small></span><ArrowRight size={17} />
                </button>
              ))}
            </div>
            <p className="lp-dialog-foot"><CircleHelp size={14} /> Continue with account details authorized for your environment.</p>
          </section>
        </div>
      )}
    </div>
  );
};
