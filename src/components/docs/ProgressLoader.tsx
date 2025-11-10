/**
 * Progress Loader Component
 * 
 * Beautiful multi-step progress indicator for document processing.
 * Shows current step with animated transitions.
 */

import { CheckCircle, Circle, Spinner as SpinnerIcon } from '@phosphor-icons/react';
import { clsx } from 'clsx';

type ProcessingStep = 'uploading' | 'extracting' | 'chunking' | 'embedding' | 'indexing' | 'complete';

interface ProgressLoaderProps {
  currentStep: ProcessingStep;
  progress?: number;
}

interface Step {
  id: ProcessingStep;
  label: string;
  status: 'pending' | 'active' | 'complete';
}

/**
 * Multi-step progress loader
 * 
 * Shows 5 steps of document processing:
 * 1. Uploading
 * 2. Extracting
 * 3. Chunking
 * 4. Embedding
 * 5. Indexing
 * 
 * Each step shows:
 * - Pending: Gray circle
 * - Active: Blue spinning icon
 * - Complete: Green checkmark
 * 
 * Usage:
 * <ProgressLoader currentStep="extracting" progress={30} />
 */
export function ProgressLoader({ currentStep, progress }: ProgressLoaderProps) {
  const stepOrder: ProcessingStep[] = ['uploading', 'extracting', 'chunking', 'embedding', 'indexing'];
  
  const stepLabels: Record<ProcessingStep, string> = {
    uploading: 'Uploading',
    extracting: 'Extracting',
    chunking: 'Chunking',
    embedding: 'Embedding',
    indexing: 'Indexing',
    complete: 'Complete'
  };
  
  const getStepStatus = (stepId: ProcessingStep): 'pending' | 'active' | 'complete' => {
    if (currentStep === 'complete') {
      return 'complete';
    }
    
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(stepId);
    
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };
  
  const steps: Step[] = stepOrder.map(id => ({
    id,
    label: stepLabels[id],
    status: getStepStatus(id)
  }));
  
  return (
    <div className="space-y-3 p-4 bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Progress Bar */}
      {progress !== undefined && (
        <div className="mb-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Processing...
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {progress}%
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-linear-to-r from-slate-500 to-slate-700 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            className={clsx(
              'flex items-center gap-3 transition-all duration-300',
              step.status === 'active' && 'scale-105'
            )}
          >
            {/* Icon */}
            <div className="shrink-0">
              {step.status === 'complete' && (
                <CheckCircle 
                  size={18} 
                  weight="fill" 
                  className="text-green-500 animate-in fade-in zoom-in duration-300" 
                />
              )}
              {step.status === 'active' && (
                <SpinnerIcon 
                  size={18} 
                  className="text-blue-500 animate-spin" 
                />
              )}
              {step.status === 'pending' && (
                <Circle 
                  size={18} 
                  className="text-gray-300 dark:text-gray-600" 
                />
              )}
            </div>
            
            {/* Label */}
            <span 
              className={clsx(
                'text-sm font-medium transition-colors duration-300',
                step.status === 'complete' && 'text-green-600 dark:text-green-400',
                step.status === 'active' && 'text-blue-600 dark:text-blue-400 font-semibold',
                step.status === 'pending' && 'text-gray-400 dark:text-gray-500'
              )}
            >
              {step.label}
            </span>
            
            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div 
                className={clsx(
                  'flex-1 h-px transition-colors duration-300',
                  step.status === 'complete' ? 'bg-green-300 dark:bg-green-700' : 'bg-gray-200 dark:bg-gray-700'
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
