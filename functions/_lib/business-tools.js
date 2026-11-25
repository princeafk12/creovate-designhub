const string = {type: 'string'};
const stringList = {type: 'array', items: string};
const object = properties => ({type: 'object', additionalProperties: false, properties, required: Object.keys(properties)});
const captions = {type: 'array', items: object({style: string, caption: string})};
const calendar = {type: 'array', items: object({day: {type: 'integer'}, theme: string, format: string, topic: string, hook: string, caption_starter: string, call_to_action: string, hashtags: stringList})};
const weekPlan = {type: 'array', items: object({day: {type: 'integer'}, action: string, expected_outcome: string})};

export const BUSINESS_TOOLS = Object.freeze({
  promo_studio: {
    slug: 'promo_studio', name: 'Promo Studio', price: 1000, currency: 'NGN', maxOutputTokens: 2800,
    description: 'A complete promotion package for a product, service, sale, announcement or lead-generation campaign.',
    deliverables: ['Campaign strategy and audience angle', 'Copy for WhatsApp, Instagram, Facebook and X', 'Headlines, calls to action, hashtags and visual direction'],
    prompt: 'Create a complete promotional campaign package. Be specific, concise, culturally appropriate for the stated audience and location, and do not invent facts, guarantees, testimonials, discounts, prices, contacts or claims.',
    fields: [
      ['business_name', 'Business name', 'text', true, 100], ['business_category', 'Business category', 'text', true, 100],
      ['offer', 'Product or service being promoted', 'textarea', true, 500], ['campaign_category', 'Campaign category', 'select', true, 80, ['Product promotion', 'Service promotion', 'Sales and discounts', 'Business announcement', 'Lead generation']],
      ['target_audience', 'Target audience', 'text', true, 240], ['selling_point', 'Main offer or selling point', 'textarea', true, 500],
      ['price', 'Price, if relevant', 'text', false, 80], ['objective', 'Campaign objective', 'text', true, 240],
      ['contact', 'Contact information', 'text', false, 240], ['tone', 'Preferred tone', 'select', true, 80, ['Clear and professional', 'Friendly and conversational', 'Bold and energetic', 'Premium and polished', 'Warm and community-focused']],
      ['platforms', 'Preferred platforms', 'text', true, 240]
    ],
    schema: object({
      campaign_strategy: string, target_audience_angle: string, headlines: stringList,
      main_promotional_copy: string, flyer_ready_text: string, whatsapp_message: string,
      instagram_caption: string, facebook_post: string, x_post: string, call_to_actions: stringList,
      hashtags: stringList, visual_direction: string
    }),
    exactCounts: {headlines: 5}
  },
  caption_studio: {
    slug: 'caption_studio', name: 'Caption Studio', price: 1000, currency: 'NGN', maxOutputTokens: 2600,
    description: 'Five ready-to-edit caption options with hooks, platform versions, calls to action and hashtags.',
    deliverables: ['Five caption variations', 'Platform-ready versions', 'Hooks, calls to action and hashtags'],
    prompt: 'Create five distinct, usable social captions based only on the supplied facts. Include clear hooks and platform-specific versions. Never invent claims, results, prices or offers.',
    fields: [
      ['business_name', 'Business or brand name', 'text', true, 100], ['business_category', 'Business category', 'text', true, 100],
      ['post_subject', 'What is this post about?', 'textarea', true, 500], ['key_details', 'Details or wording to include', 'textarea', true, 500],
      ['target_audience', 'Target audience', 'text', true, 240], ['platforms', 'Platforms', 'text', true, 240],
      ['tone', 'Preferred tone', 'select', true, 80, ['Clear and professional', 'Friendly and conversational', 'Bold and energetic', 'Premium and polished', 'Warm and community-focused']],
      ['objective', 'Post objective', 'text', true, 240], ['call_to_action', 'Preferred call to action', 'text', false, 200],
      ['hashtags_to_avoid', 'Hashtags or words to avoid', 'text', false, 200]
    ],
    schema: object({
      post_angle: string, hook_options: stringList, caption_variations: captions,
      platform_versions: object({instagram: string, facebook: string, whatsapp: string, x: string}),
      call_to_actions: stringList, hashtags: stringList, visual_pairing: string
    }),
    exactCounts: {hook_options: 5, caption_variations: 5}
  },
  content_planner: {
    slug: 'content_planner', name: '30-Day Content Planner', price: 1500, currency: 'NGN', maxOutputTokens: 7200,
    description: 'A 30-day content calendar with themes, formats, topics, hooks, caption starters and calls to action.',
    deliverables: ['30 daily content ideas', 'Weekly themes and formats', 'Hooks, caption starters, calls to action and hashtags'],
    prompt: 'Create exactly 30 practical daily content entries for a 30-day plan. Vary formats and topics, keep the schedule realistic for the stated capacity, and do not invent business facts or claims.',
    fields: [
      ['business_name', 'Business or brand name', 'text', true, 100], ['business_category', 'Business category', 'text', true, 100],
      ['offer', 'Products or services', 'textarea', true, 500], ['target_audience', 'Target audience', 'text', true, 240],
      ['platforms', 'Platforms', 'text', true, 240], ['objective', 'Main 30-day goal', 'text', true, 240],
      ['posting_capacity', 'Posting capacity', 'select', true, 80, ['Daily', '5 days per week', '3 days per week']],
      ['tone', 'Preferred tone', 'select', true, 80, ['Clear and professional', 'Friendly and conversational', 'Bold and energetic', 'Premium and polished', 'Warm and community-focused']],
      ['important_dates', 'Important dates or offers', 'textarea', false, 300]
    ],
    schema: object({
      strategy: string, weekly_themes: stringList, calendar: calendar,
      measurement_notes: stringList, repurposing_tips: stringList
    }),
    exactCounts: {calendar: 30, weekly_themes: 4}
  },
  business_growth_kit: {
    slug: 'business_growth_kit', name: 'Business Growth Kit', price: 3000, currency: 'NGN', maxOutputTokens: 4800,
    description: 'A practical growth blueprint covering positioning, customers, differentiation, marketing and next actions.',
    deliverables: ['Positioning and ideal customer profile', 'Differentiation and marketing opportunities', 'Seven-day action plan, risks and measures'],
    prompt: 'Create a practical business growth blueprint. Separate user-provided facts from assumptions, avoid guaranteed outcomes, unsupported market claims, or invented competitor data, and give low-cost actions first.',
    fields: [
      ['business_name', 'Business or brand name', 'text', true, 100], ['business_category', 'Industry or category', 'text', true, 100],
      ['offer', 'Products or services', 'textarea', true, 500], ['target_audience', 'Current or intended customers', 'text', true, 240],
      ['location', 'Country or service area', 'text', true, 160], ['current_challenge', 'Main growth challenge', 'textarea', true, 400],
      ['goal', 'Main 90-day goal', 'text', true, 240], ['budget', 'Monthly marketing budget', 'text', false, 100],
      ['resources', 'Existing strengths or resources', 'textarea', false, 300], ['preferred_tone', 'Preferred tone', 'select', true, 80, ['Clear and professional', 'Friendly and conversational', 'Bold and energetic', 'Premium and polished', 'Warm and community-focused']]
    ],
    schema: object({
      executive_summary: string, positioning: string,
      ideal_customer_profile: object({customer: string, needs: string, buying_motivations: stringList}),
      value_proposition: string, differentiators: stringList, growth_opportunities: stringList,
      marketing_channels: stringList, offer_recommendation: string,
      seven_day_action_plan: weekPlan, '30_day_measures': stringList, risks_and_unknowns: stringList
    }),
    exactCounts: {seven_day_action_plan: 7}
  }
});

export function toolBrief(slug, raw) {
  const product = BUSINESS_TOOLS[slug];
  if (!product) throw new Error('That business tool is not available.');
  const brief = {};
  for (const [name, , , , maxLength] of product.fields) {
    const value = raw?.[name];
    brief[name] = String(value ?? '').trim().slice(0, maxLength);
  }
  const missing = product.fields.filter(([name, , , required]) => required && !brief[name]).map(([, label]) => label);
  if (missing.length) throw new Error(`Complete these required fields: ${missing.join(', ')}.`);
  for (const [name, label, , , , options] of product.fields) {
    if (options?.length && brief[name] && !options.includes(brief[name])) throw new Error(`Choose a valid option for ${label}.`);
  }
  return brief;
}

export function validateToolResult(slug, value) {
  const product = BUSINESS_TOOLS[slug];
  const validate = (data, schema, path = 'result') => {
    if (schema.type === 'object') {
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`AI output is invalid at ${path}.`);
      const required = schema.required || [];
      if (required.some(key => !(key in data))) throw new Error(`AI output is missing a required section at ${path}.`);
      if (schema.additionalProperties === false && Object.keys(data).some(key => !(key in schema.properties))) throw new Error(`AI output contains an unexpected section at ${path}.`);
      for (const [key, child] of Object.entries(schema.properties || {})) validate(data[key], child, `${path}.${key}`);
      return;
    }
    if (schema.type === 'array') {
      if (!Array.isArray(data) || data.length === 0) throw new Error(`AI output is incomplete at ${path}.`);
      data.forEach((item, index) => validate(item, schema.items, `${path}[${index}]`));
      return;
    }
    if (schema.type === 'string') {
      if (typeof data !== 'string' || !data.trim() || data.length > 12000) throw new Error(`AI output is incomplete at ${path}.`);
      return;
    }
    if (schema.type === 'integer' && (!Number.isInteger(data) || data < 1 || data > 30)) throw new Error(`AI output is invalid at ${path}.`);
  };
  validate(value, product.schema);
  for (const [key, count] of Object.entries(product.exactCounts || {})) {
    if (!Array.isArray(value[key]) || value[key].length !== count) throw new Error(`AI output must include exactly ${count} ${key.replaceAll('_', ' ')}.`);
    if (key === 'calendar' && value[key].some((item, index) => item.day !== index + 1)) throw new Error('AI output must list the content calendar in order from day 1 to day 30.');
    if (key === 'seven_day_action_plan' && value[key].some((item, index) => item.day !== index + 1)) throw new Error('AI output must list the action plan in order from day 1 to day 7.');
  }
  return value;
}

export function publicToolCatalog() {
  return Object.values(BUSINESS_TOOLS).map(({slug, name, price, currency, description, deliverables, fields}) => ({
    slug, name, price, currency, description, deliverables,
    fields: fields.map(([key, label, type, required, maxLength, options]) => ({key, label, type, required, maxLength, options: options || []}))
  }));
}
