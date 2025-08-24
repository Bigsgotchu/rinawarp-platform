// Enhanced GA4 Tracking
class EnhancedAnalytics {
  constructor() {
    this.initGA4();
    this.setupEventListeners();
  }

  initGA4() {
    // Initialize GA4 with your measurement ID
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-XXXXXXXXXX'); // Replace with your GA4 measurement ID
  }

  setupEventListeners() {
    // Track pricing page views
    this.trackPageView();

    // Track pricing card interactions
    document.querySelectorAll('.pricing-card').forEach(card => {
      card.addEventListener('click', () => this.trackPricingCardClick(card));
    });

    // Track CTA button clicks
    document.querySelectorAll('.cta-button').forEach(button => {
      button.addEventListener('click', () => this.trackCTAClick(button));
    });

    // Track feature list expansions
    document.querySelectorAll('.feature-list').forEach(list => {
      list.addEventListener('click', () => this.trackFeatureListClick(list));
    });
  }

  trackPageView() {
    gtag('event', 'page_view', {
      page_title: 'Pricing Page',
      page_location: window.location.href,
      page_path: window.location.pathname
    });
  }

  trackPricingCardClick(card) {
    const planName = card.querySelector('.plan-name').textContent;
    const planPrice = card.querySelector('.plan-price').textContent;

    gtag('event', 'pricing_card_click', {
      event_category: 'Pricing',
      event_label: planName,
      plan_name: planName,
      plan_price: planPrice
    });
  }

  trackCTAClick(button) {
    const planCard = button.closest('.pricing-card');
    const planName = planCard ? planCard.querySelector('.plan-name').textContent : 'Unknown';

    gtag('event', 'cta_click', {
      event_category: 'Pricing',
      event_label: `${planName} - CTA`,
      plan_name: planName
    });
  }

  trackFeatureListClick(list) {
    const planCard = list.closest('.pricing-card');
    const planName = planCard ? planCard.querySelector('.plan-name').textContent : 'Unknown';
    const feature = list.textContent;

    gtag('event', 'feature_click', {
      event_category: 'Pricing',
      event_label: feature,
      plan_name: planName,
      feature_name: feature
    });
  }
}

// Initialize analytics when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new EnhancedAnalytics();
});
