import { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { User, Mail, Phone, Lock, Eye, EyeOff, CreditCard, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '../hooks/useIsMobile';

interface RegistrationFormProps {
  onSubmit: (data: RegistrationData) => void;
  isLoading?: boolean;
}

export interface RegistrationData {
  name: string;
  email: string;
  phone: string;
  password: string;
  studentId: string;
  nin: string;
}

export function RegistrationForm({ onSubmit, isLoading = false }: RegistrationFormProps) {
  const { isMobile } = useIsMobile();
  
  const [formData, setFormData] = useState({
    name: 'nelson',
    email: 'nelson@gmail.com',
    phone: '08012345678',
    password: 'password',
    confirmPassword: 'password',
    studentId: '',
    nin: '',
  });

  const [errors, setErrors] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',

  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateForm = () => {
    const newErrors = {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    };

    let isValid = true;

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
      isValid = false;
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
      isValid = false;
    }

    // Phone validation
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
      isValid = false;
    } else if (!/^[0-9]{10,11}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
      isValid = false;
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
      isValid = false;
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields correctly');
      return;
    }

    onSubmit({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      studentId: formData.studentId,
      nin: formData.nin,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.1 }}
  >
    <div className={isMobile ? 'space-y-5' : 'grid grid-cols-2 gap-6'}>
      {/* Name */}
      <div className={!isMobile ? 'col-span-2' : ''}>
        <Label style={{ color: '#B3B3B3' }}>
          Full Name <span style={{ color: '#FF4D4D' }}>*</span>
        </Label>
        <div className="relative mt-2">
          <User
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: '#666666' }}
          />
          <Input
            type="text"
            placeholder="Enter your full name"
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              setErrors({ ...errors, name: '' });
            }}
            className="pl-10"
            style={{
              backgroundColor: '#1E1E1E',
              borderColor: errors.name ? '#FF4D4D' : '#333333',
              color: '#FFFFFF',
            }}
          />
        </div>
        {errors.name && (
          <p className="text-xs mt-1" style={{ color: '#FF4D4D' }}>
            {errors.name}
          </p>
        )}
      </div>

      {/* Email */}
      <div>
        <Label style={{ color: '#B3B3B3' }}>
          Email Address <span style={{ color: '#FF4D4D' }}>*</span>
        </Label>
        <div className="relative mt-2">
          <Mail
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: '#666666' }}
          />
          <Input
            type="email"
            placeholder="your.email@university.edu"
            value={formData.email}
            onChange={(e) => {
              setFormData({ ...formData, email: e.target.value });
              setErrors({ ...errors, email: '' });
            }}
            className="pl-10"
            style={{
              backgroundColor: '#1E1E1E',
              borderColor: errors.email ? '#FF4D4D' : '#333333',
              color: '#FFFFFF',
            }}
          />
        </div>
        {errors.email && (
          <p className="text-xs mt-1" style={{ color: '#FF4D4D' }}>
            {errors.email}
          </p>
        )}
      </div>

      {/* Phone */}
      <div>
        <Label style={{ color: '#B3B3B3' }}>
          Phone Number <span style={{ color: '#FF4D4D' }}>*</span>
        </Label>
        <div className="relative mt-2">
          <Phone
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: '#666666' }}
          />
          <Input
            type="tel"
            placeholder="08012345678"
            value={formData.phone}
            onChange={(e) => {
              setFormData({ ...formData, phone: e.target.value });
              setErrors({ ...errors, phone: '' });
            }}
            className="pl-10"
            style={{
              backgroundColor: '#1E1E1E',
              borderColor: errors.phone ? '#FF4D4D' : '#333333',
              color: '#FFFFFF',
            }}
          />
        </div>
        {errors.phone && (
          <p className="text-xs mt-1" style={{ color: '#FF4D4D' }}>
            {errors.phone}
          </p>
        )}
        </div>
        
            {/* Password */}
            <div>
          <Label style={{ color: '#B3B3B3' }}>
            Password <span style={{ color: '#FF4D4D' }}>*</span>
          </Label>
          <div className="relative mt-2">
            <Lock
              size={20}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: '#666666' }}
            />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              value={formData.password}
              onChange={(e) => {
                setFormData({ ...formData, password: e.target.value });
                setErrors({ ...errors, password: '' });
              }}
              onKeyPress={handleKeyPress}
              className="pl-10 pr-10"
              style={{
                backgroundColor: '#1E1E1E',
                borderColor: errors.password ? '#FF4D4D' : '#333333',
                color: '#FFFFFF',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              {showPassword ? (
                <EyeOff size={20} style={{ color: '#666666' }} />
              ) : (
                <Eye size={20} style={{ color: '#666666' }} />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs mt-1" style={{ color: '#FF4D4D' }}>
              {errors.password}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <Label style={{ color: '#B3B3B3' }}>
            Confirm Password <span style={{ color: '#FF4D4D' }}>*</span>
          </Label>
          <div className="relative mt-2">
            <Lock
              size={20}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: '#666666' }}
            />
            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={(e) => {
                setFormData({ ...formData, confirmPassword: e.target.value });
                setErrors({ ...errors, confirmPassword: '' });
              }}
              onKeyPress={handleKeyPress}
              className="pl-10 pr-10"
              style={{
                backgroundColor: '#1E1E1E',
                borderColor: errors.confirmPassword ? '#FF4D4D' : '#333333',
                color: '#FFFFFF',
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              {showConfirmPassword ? (
                <EyeOff size={20} style={{ color: '#666666' }} />
              ) : (
                <Eye size={20} style={{ color: '#666666' }} />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs mt-1" style={{ color: '#FF4D4D' }}>
              {errors.confirmPassword}
            </p>
          )}
        </div>

      {/* Optional Fields Section */}
      <div className="col-span-2 pt-6" style={{ borderTop: '1px solid #333333' }}>
        <p className="text-sm mb-6" style={{ color: '#666666' }}>
          Optional Information
        </p>

        <div className={isMobile ? 'space-y-4' : 'grid grid-cols-2 gap-6'}>
          {/* Student ID */}
          <div>
            <Label style={{ color: '#B3B3B3' }}>Student ID (Optional)</Label>
            <div className="relative mt-2">
              <CreditCard
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: '#666666' }}
              />
              <Input
                type="text"
                placeholder="Enter your student ID"
                value={formData.studentId}
                onChange={(e) =>
                  setFormData({ ...formData, studentId: e.target.value })
                }
                className="pl-10"
                style={{
                  backgroundColor: '#1E1E1E',
                  borderColor: '#333333',
                  color: '#FFFFFF',
                }}
              />
            </div>
          </div>

          {/* NIN */}
          <div>
            <Label style={{ color: '#B3B3B3' }}>NIN (Optional)</Label>
            <div className="relative mt-2">
              <Shield
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: '#666666' }}
              />
              <Input
                type="text"
                placeholder="Enter your NIN"
                value={formData.nin}
                onChange={(e) =>
                  setFormData({ ...formData, nin: e.target.value })
                }
                className="pl-10"
                style={{
                  backgroundColor: '#1E1E1E',
                  borderColor: '#333333',
                  color: '#FFFFFF',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Continue Button */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="mt-8"
    >
      {/* {!isMobile && (
        <div 
          className="p-4 rounded-lg mb-6"
          style={{ backgroundColor: 'rgba(90, 200, 250, 0.1)', borderLeft: '3px solid #5AC8FA' }}
        >
          <p className="text-sm" style={{ color: '#B3B3B3' }}>
            📧 We'll use your email for account verification and important updates
          </p>
        </div>
      )} */}
      
      <Button
        onClick={handleSubmit}
        className="w-full"
        style={{ backgroundColor: '#9945FF', color: '#FFFFFF' }}
      >
       {isLoading ? 'Creating Account...' : 'Create Account'}
      </Button>
    </motion.div>
  </motion.div>
  );
}
