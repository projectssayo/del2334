import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

// ES6 module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ========== SECURITY & MIDDLEWARE ==========
// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api/', limiter);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https://shaadi.org"],
      connectSrc: ["'self'"],
    },
  },
}));

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ========== CALCULATION LOGIC ==========
const calculateWorth = (data) => {
  const {
    age, profession, salary, education,
    residence, country, caste, skin, purity
  } = data;

  let base = 0;

  // Age points
  const ageMap = {
    "18-24": 6, "25-30": 14, "31-35": 11,
    "36-40": 6, "more than 40": 3
  };
  base += ageMap[age] || 0;

  // Profession points
  const profMap = {
    "Entrepreneur": 18, "Engineer": 15, "Doctor": 22,
    "Investment Banker": 28, "Brand Manager": 14,
    "Product Manager": 17, "Content Creator": 9, "Others": 6
  };
  base += profMap[profession] || 8;

  // Salary points
  const salaryMap = {
    "Less than 50000": 2, "50100-1 lakh": 6,
    "1-2 lakhs": 12, "2-5 lakhs": 22, "more than 5 lakhs": 38
  };
  base += salaryMap[salary] || 4;

  // Education points
  const eduMap = {
    "High School": 2, "Graduation": 9,
    "Post Graduation": 17, "PhD": 26, "Dropout": 3
  };
  base += eduMap[education] || 5;

  // Residence points
  const resMap = { "Self-owned": 16, "Rented": 4, "Parent’s house": 2 };
  base += resMap[residence] || 2;

  // Country points
  if (country === "Abroad") base += 22;
  else if (country === "India") base += 5;

  // Caste points
  if (caste === "NON CHAMAR") base += 20;
  else if (caste === "CHAMAR") base += 2;

  // Skin color points
  if (skin === "GORA") base += 18;
  else if (skin === "SANWALA") base += 7;
  else if (skin === "JAMWAL") base += 1;

  // Purity points
  if (purity === "0") base += 24;
  else if (purity === "less5") base += 6;
  else if (purity === "rand") base += 0;

  // Convert to rupees
  let totalLakhs = (base * 0.15) + 1.5;
  totalLakhs = Math.min(Math.max(totalLakhs, 1.5), 60);

  return {
    amount: totalLakhs * 100000,
    basePoints: base,
    breakdown: {
      age, profession, salary, education, residence, country, caste, skin, purity
    }
  };
};

const formatWorth = (amount) => {
  if (amount >= 10000000) {
    return `₹ ${(amount / 10000000).toFixed(1)} Crore`;
  } else if (amount >= 100000) {
    return `₹ ${(amount / 100000).toFixed(1)} Lakhs`;
  }
  return `₹ ${amount.toLocaleString('en-IN')}`;
};

const getHumorousMessage = (amount, caste, skin, purity) => {
  const lakhs = amount / 100000;
  
  let msg = '';
  if (lakhs >= 40) msg = "🔥 Extremely high 'market rate'! Privilege is inflating this number massively. ";
  else if (lakhs >= 25) msg = "💰 Premium valuation by regressive filters. Dowry is illegal — your worth is not in rupees. ";
  else if (lakhs >= 10) msg = "📊 Middle-tier mock valuation. The system devalues many based on identity. ";
  else msg = "⚠️ Low 'dowry index'. This is exactly why we must dismantle these standards. ";

  if (caste === "CHAMAR" || skin === "JAMWAL" || purity === "rand") {
    msg += "⚡ The calculator punishes you for identity — that's the point. Real value transcends bigotry.";
  } else {
    msg += "🎭 Privilege inflates the number. Use your voice against dowry.";
  }
  
  return msg;
};

// ========== ROUTES ==========
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint for calculation
app.post('/api/calculate', async (req, res) => {
  try {
    const { age, profession, salary, education, residence, country, caste, skin, purity } = req.body;
    
    // Validate required fields
    const requiredFields = { age, profession, salary, education, residence, country, caste, skin, purity };
    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missing: missingFields 
      });
    }

    // Calculate worth
    const { amount, basePoints, breakdown } = calculateWorth(req.body);
    const formatted = formatWorth(amount);
    const message = getHumorousMessage(amount, caste, skin, purity);
    
    res.json({ 
      success: true, 
      amount: amount,
      formatted: formatted,
      message: message,
      metadata: {
        basePoints: basePoints,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    });
    
  } catch (error) {
    console.error('Calculation error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something broke!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  🚀 Dowry Calculator Server Started
  📡 Running on: http://localhost:${PORT}
  🌍 Environment: ${process.env.NODE_ENV || 'development'}
  📊 API Endpoint: http://localhost:${PORT}/api/calculate
  ❤️ Health Check: http://localhost:${PORT}/health
  `);
});
