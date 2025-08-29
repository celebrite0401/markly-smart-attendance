import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface TimeSlot {
  day: string;
  time: string;
  duration: number;
}

interface TimetableGridProps {
  schedule: Record<string, TimeSlot[]>;
  onScheduleChange: (newSchedule: Record<string, TimeSlot[]>) => void;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', 
  '13:00', '14:00', '15:00', '16:00', '17:00'
];

const TimetableGrid: React.FC<TimetableGridProps> = ({ schedule, onScheduleChange }) => {
  const [selectedSlot, setSelectedSlot] = useState<{ day: string; time: string } | null>(null);
  
  const getSlotForDayTime = (day: string, time: string): TimeSlot | null => {
    const daySlots = schedule[day] || [];
    return daySlots.find(slot => slot.time === time) || null;
  };

  const addSlot = (day: string, time: string) => {
    const newSchedule = { ...schedule };
    if (!newSchedule[day]) {
      newSchedule[day] = [];
    }
    
    // Check if slot already exists
    const existingSlot = newSchedule[day].find(slot => slot.time === time);
    if (existingSlot) return;
    
    newSchedule[day].push({ day, time, duration: 60 });
    onScheduleChange(newSchedule);
  };

  const removeSlot = (day: string, time: string) => {
    const newSchedule = { ...schedule };
    if (newSchedule[day]) {
      newSchedule[day] = newSchedule[day].filter(slot => slot.time !== time);
      if (newSchedule[day].length === 0) {
        delete newSchedule[day];
      }
    }
    onScheduleChange(newSchedule);
  };

  const updateDuration = (day: string, time: string, duration: number) => {
    const newSchedule = { ...schedule };
    if (newSchedule[day]) {
      const slotIndex = newSchedule[day].findIndex(slot => slot.time === time);
      if (slotIndex !== -1) {
        newSchedule[day][slotIndex].duration = duration;
        onScheduleChange(newSchedule);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Click on time slots to add class periods. Click on existing slots to remove them.
      </div>
      
      {/* Timetable Grid */}
      <div className="border rounded-lg overflow-hidden bg-background">
        {/* Header Row */}
        <div className="grid grid-cols-6 bg-muted/50">
          <div className="p-3 font-semibold text-center border-r">Time</div>
          {DAYS.map(day => (
            <div key={day} className="p-3 font-semibold text-center border-r last:border-r-0 capitalize">
              {day.slice(0, 3)}
            </div>
          ))}
        </div>
        
        {/* Time Slots */}
        {TIME_SLOTS.map(time => (
          <div key={time} className="grid grid-cols-6 border-t">
            <div className="p-3 text-center font-mono text-sm bg-muted/30 border-r">
              {time}
            </div>
            {DAYS.map(day => {
              const slot = getSlotForDayTime(day, time);
              return (
                <div 
                  key={`${day}-${time}`} 
                  className="p-2 border-r last:border-r-0 min-h-[60px] flex items-center justify-center relative group"
                >
                  {slot ? (
                    <div className="relative w-full">
                      <Badge 
                        variant="secondary" 
                        className="w-full justify-center py-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors group"
                        onClick={() => removeSlot(day, time)}
                      >
                        <span className="text-xs">{slot.duration}min</span>
                        <X className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Badge>
                      
                      {/* Duration selector */}
                      <div className="absolute top-full left-0 right-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <div className="flex gap-1 justify-center">
                          {[30, 60, 90, 120].map(duration => (
                            <button
                              key={duration}
                              className="text-xs px-1 py-0.5 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateDuration(day, time, duration);
                              }}
                            >
                              {duration}m
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => addSlot(day, time)}
                    >
                      +
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      
      {/* Schedule Summary */}
      {Object.keys(schedule).length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2">Schedule Summary:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(schedule).map(([day, slots]) => (
              <div key={day} className="text-sm bg-muted/50 p-2 rounded">
                <div className="font-medium capitalize mb-1">{day}:</div>
                {slots.map((slot, index) => (
                  <div key={index} className="text-xs text-muted-foreground">
                    {slot.time} ({slot.duration}min)
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimetableGrid;