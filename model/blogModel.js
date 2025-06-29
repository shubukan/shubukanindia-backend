const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Schema for individual content blocks within sections
const contentBlockSchema = new Schema({
  type: {
    type: String,
    required: true,
    enum: ['text', 'image', 'video', 'quote', 'code', 'embed', 'table', 'html', 'callout', 'list']
  },
  order: {
    type: Number,
    required: true
  },
  // Text block content
  text: {
    type: String,
    required: function() { return this.type === 'text' || this.type === 'quote' || this.type === 'code' || this.type === 'html' }
  },
  // For advanced text formatting options
  formatting: {
    isBold: { type: Boolean, default: false },
    isItalic: { type: Boolean, default: false },
    isUnderlined: { type: Boolean, default: false },
    alignment: { type: String, enum: ['left', 'center', 'right', 'justify'], default: 'left' },
    fontSize: { type: String, default: 'normal' },
    textColor: { type: String },
    backgroundColor: { type: String }
  },
  // Media-specific fields
  mediaUrl: {
    type: String,
    required: function() { return this.type === 'image' || this.type === 'video' || this.type === 'embed' }
  },
  caption: {
    type: String
  },
  altText: {
    type: String
  },
  // For code blocks
  language: {
    type: String
  },
  // For embed blocks (like social media, maps, etc.)
  embedType: {
    type: String,
    enum: ['youtube', 'twitter', 'instagram', 'facebook', 'map', 'other']
  },
  embedCode: {
    type: String
  },
  // For table content
  tableData: {
    headers: [String],
    rows: [[String]]
  },
  // For lists
  listType: {
    type: String,
    enum: ['bullet', 'numbered', 'checklist']
  },
  listItems: [String],
  // For callout boxes
  calloutStyle: {
    type: String,
    enum: ['info', 'warning', 'success', 'error', 'note', 'tip']
  }
});

// Schema for customizable sections within the blog
const sectionSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String
  },
  layout: {
    type: String,
    enum: ['full-width', 'two-column', 'three-column', 'sidebar-left', 'sidebar-right', 'grid', 'featured'],
    default: 'full-width'
  },
  backgroundColor: {
    type: String
  },
  backgroundImage: {
    type: String
  },
  order: {
    type: Number,
    required: true
  },
  // Content blocks for this section
  contentBlocks: [contentBlockSchema],
  // Whether this section should display in table of contents
  showInTOC: {
    type: Boolean,
    default: true
  },
  // Optional custom CSS class for this section
  customClass: {
    type: String
  },
  // Additional section-specific styles
  sectionStyles: {
    paddingTop: { type: Number },
    paddingBottom: { type: Number },
    paddingLeft: { type: Number },
    paddingRight: { type: Number },
    marginTop: { type: Number },
    marginBottom: { type: Number },
    borderRadius: { type: Number },
    borderColor: { type: String },
    borderWidth: { type: Number },
    borderStyle: { type: String, enum: ['none', 'solid', 'dashed', 'dotted'] }
  }
});

// Schema for related content
const relatedContentSchema = new Schema({
  type: {
    type: String,
    enum: ['blog', 'article', 'external', 'product'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  link: {
    type: String,
    required: true
  },
  thumbnailImage: {
    type: String
  },
  description: {
    type: String
  },
  source: {
    type: String
  },
  priority: {
    type: Number,
    default: 0
  }
});

// Author schema with detailed information
const authorSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  title: {
    type: String
  },
  biography: {
    type: String
  },
  avatarImage: {
    type: String
  },
  email: {
    type: String
  },
  website: {
    type: String
  },
  socialMedia: {
    twitter: String,
    linkedin: String,
    facebook: String,
    instagram: String
  }
});

// Schema for SEO metadata
const seoSchema = new Schema({
  metaTitle: {
    type: String
  },
  metaDescription: {
    type: String
  },
  keywords: [String],
  ogImage: {
    type: String
  },
  canonicalUrl: {
    type: String
  },
  structuredData: {
    type: Object
  },
  noIndex: {
    type: Boolean,
    default: false
  }
});

// Main blog post schema
const blogSchema = new Schema({
  // Basic information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  subtitle: {
    type: String,
    trim: true,
    maxlength: 300
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  
  // Content organization
  summary: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  shortNote: {
    type: String,
    trim: true,
    maxlength: 500
  },
  sections: [sectionSchema],
  
  // Media
  coverImage: {
    url: {
      type: String,
      required: true
    },
    caption: String,
    altText: String,
    credit: String
  },
  thumbnailImage: {
    url: {
      type: String
    },
    caption: String,
    altText: String
  },
  featuredMedia: {
    type: {
      type: String,
      enum: ['image', 'video', 'gallery', 'audio', 'none'],
      default: 'none'
    },
    urls: [String],
    caption: String,
    credit: String
  },
  
  // Classification
  category: {
    primary: {
      type: String,
      required: true
    },
    secondary: [String]
  },
  tags: {
    type: [String],
    index: true
  },
  
  // Attribution
  authors: [authorSchema],
  
  // Publication details
  publishedDate: {
    type: Date,
    default: Date.now
  },
  modifiedDate: {
    type: Date
  },
  scheduledPublishDate: {
    type: Date
  },
  estimatedReadTime: {
    type: Number
  },
  
  // Related content
  relatedContent: [relatedContentSchema],
  
  // Status and visibility
  status: {
    type: String,
    enum: ['draft', 'published', 'scheduled', 'archived'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'members', 'premium', 'private'],
    default: 'public'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isBreakingNews: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  
  // Comments
  allowComments: {
    type: Boolean,
    default: true
  },
  commentsCount: {
    type: Number,
    default: 0
  },
  
  // Stats and analytics
  viewCount: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  shareCount: {
    type: Number,
    default: 0
  },
  
  // Display preferences
  layout: {
    type: String,
    enum: ['standard', 'feature', 'grid', 'magazine', 'newsletter', 'longform', 'multimedia'],
    default: 'standard'
  },
  theme: {
    type: String,
    default: 'default'
  },
  customCSS: {
    type: String
  },
  
  // SEO
  seo: seoSchema,
  
  // Advanced settings
  languageCode: {
    type: String,
    default: 'en'
  },
  locale: {
    type: String,
    default: 'en-US'
  },
  geographicFocus: [String],
  
  // Translation and internationalization
  translations: [{
    languageCode: String,
    title: String,
    content: String,
    slug: String
  }],
  
  // Custom fields for extensibility
  customFields: {
    type: Map,
    of: Schema.Types.Mixed
  }
}, 
{ 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create an index for efficient searches
blogSchema.index({ 
  title: 'text', 
  summary: 'text',
  'sections.title': 'text', 
  'sections.contentBlocks.text': 'text' 
});

// Virtual for URL
blogSchema.virtual('url').get(function() {
  return `/blog/${this.slug}`;
});

// Pre-save hook to generate slug if not provided
blogSchema.pre('save', function(next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(/-+/g, '-') // Replace multiple - with single -
      .trim();
  }
  
  // Update modified date
  if (this.isModified() && !this.isNew) {
    this.modifiedDate = new Date();
  }
  
  // Calculate estimated read time based on content length
  const totalContentLength = this.sections.reduce((count, section) => {
    return count + section.contentBlocks.reduce((blockCount, block) => {
      if (block.type === 'text') {
        return blockCount + (block.text ? block.text.split(/\s+/).length : 0);
      }
      return blockCount;
    }, 0);
  }, 0);
  
  // Average reading speed: 200 words per minute
  this.estimatedReadTime = Math.ceil(totalContentLength / 200);
  
  next();
});

module.exports = mongoose.model("Blog", blogSchema);