import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Users, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TimeSlot {
  day: string;
  time: string;
  duration: number;
}

interface Class {
  id: string;
  name: string;
  description?: string;
  teacher_id: string;
  schedule?: any; // Change from TimeSlot[] to any to match Supabase Json type
  teacher?: { name: string };
  enrollments?: { count: number }[];
}

interface WeeklyScheduleProps {
  showSectionFilter?: boolean;
  userRole?: 'student' | 'admin';
  studentSection?: string; // For automatic filtering when student views their schedule
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', 
  '13:00', '14:00', '15:00', '16:00', '17:00'
];

const WeeklySchedule: React.FC<WeeklyScheduleProps> = ({ 
  showSectionFilter = true, 
  userRole = 'student',
  studentSection
}) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [sections, setSections] = useState<string[]>([]);

  useEffect(() => {
    fetchClasses();
    if (showSectionFilter) {
      fetchSections();
    }
    // Auto-set student section if provided
    if (studentSection && !showSectionFilter) {
      setSelectedSection(studentSection);
    }
  }, [showSectionFilter, studentSection]);

  useEffect(() => {
    if (selectedSection === 'all') {
      setFilteredClasses(classes);
    } else {
      // Filter classes based on selected section
      // This requires checking enrollments for the selected section
      filterClassesBySection();
    }
  }, [selectedSection, classes]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const { data: classesData, error } = await supabase
        .from('classes')
        .select(`
          *,
          teacher:profiles!classes_teacher_id_fkey(name),
          enrollments(count)
        `);

      if (error) throw error;
      setClasses(classesData || []);
      setFilteredClasses(classesData || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error('Failed to load weekly schedule');
    } finally {
      setLoading(false);
    }
  };

  const fetchSections = async () => {
    try {
      const { data: sectionsData, error } = await supabase
        .from('profiles')
        .select('section')
        .eq('role', 'student')
        .not('section', 'is', null);

      if (error) throw error;
      
      const uniqueSections = [...new Set(sectionsData?.map(s => s.section).filter(Boolean) || [])];
      setSections(uniqueSections);
    } catch (error) {
      console.error('Error fetching sections:', error);
    }
  };

  const filterClassesBySection = async () => {
    if (selectedSection === 'all') {
      setFilteredClasses(classes);
      return;
    }

    try {
      // Get classes that have enrollments from the selected section
      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select(`
          class_id,
          student:profiles!enrollments_student_id_fkey(section)
        `)
        .eq('student.section', selectedSection);

      if (error) throw error;

      const classIds = enrollments?.map(e => e.class_id) || [];
      const sectionClasses = classes.filter(cls => classIds.includes(cls.id));
      setFilteredClasses(sectionClasses);
    } catch (error) {
      console.error('Error filtering classes by section:', error);
    }
  };

  const getClassForSlot = (day: string, time: string): Class | null => {
    return filteredClasses.find(cls => {
      const schedule = cls.schedule;
      // Handle both object format (from TimetableGrid) and array format
      let scheduleArray: TimeSlot[] = [];
      
      if (Array.isArray(schedule)) {
        scheduleArray = schedule;
      } else if (schedule && typeof schedule === 'object') {
        // Convert object format to array format
        scheduleArray = Object.values(schedule).flat() as TimeSlot[];
      }
      
      return scheduleArray.some(slot => 
        slot.day?.toLowerCase() === day && slot.time === time
      );
    }) || null;
  };

  const getEnrollmentCount = (classItem: Class): number => {
    return classItem.enrollments?.[0]?.count || 0;
  };

  if (loading) {
    return (
      <Card className="shadow-elegant border-0">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Loading weekly schedule...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-elegant border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Weekly Schedule</CardTitle>
          </div>
          
          {showSectionFilter && sections.length > 0 && (
            <Select value={selectedSection} onValueChange={setSelectedSection}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="all">All Sections</SelectItem>
                {sections.map(section => (
                  <SelectItem key={section} value={section}>
                    Section {section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {filteredClasses.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {selectedSection === 'all' 
                ? 'No classes scheduled' 
                : `No classes found for section ${selectedSection}`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[900px] lg:min-w-full border rounded-lg overflow-hidden bg-background">
              {/* Header Row */}
              <div className="grid grid-cols-6 bg-muted/50">
                <div className="p-3 lg:p-4 font-semibold text-center border-r text-sm lg:text-base">Time</div>
                {DAYS.map(day => (
                  <div key={day} className="p-3 lg:p-4 font-semibold text-center border-r last:border-r-0 capitalize text-sm lg:text-base">
                    {day.slice(0, 3)}
                  </div>
                ))}
              </div>
              
              {/* Time Slots */}
              {TIME_SLOTS.map(time => (
                <div key={time} className="grid grid-cols-6 border-t">
                  <div className="p-3 lg:p-4 text-center font-mono text-xs lg:text-sm bg-muted/30 border-r">
                    {time}
                  </div>
                  {DAYS.map(day => {
                    const classForSlot = getClassForSlot(day, time);
                    return (
                      <div 
                        key={`${day}-${time}`} 
                        className="p-2 lg:p-3 border-r last:border-r-0 min-h-[80px] lg:min-h-[90px] flex items-center justify-center"
                      >
                        {classForSlot ? (
                          <div className="w-full">
                            <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 lg:p-3 hover:bg-primary/20 transition-colors">
                              <div className="text-xs lg:text-sm font-semibold text-primary mb-1 truncate">
                                {classForSlot.name}
                              </div>
                              <div className="text-xs text-muted-foreground mb-2 truncate">
                                {classForSlot.teacher?.name || 'Unknown Teacher'}
                              </div>
                              <div className="flex items-center justify-between flex-wrap gap-1">
                                <Badge variant="secondary" className="text-xs">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {(() => {
                                    const schedule = classForSlot.schedule;
                                    let scheduleArray: TimeSlot[] = [];
                                    
                                    if (Array.isArray(schedule)) {
                                      scheduleArray = schedule;
                                    } else if (schedule && typeof schedule === 'object') {
                                      scheduleArray = Object.values(schedule).flat() as TimeSlot[];
                                    }
                                    
                                    const slot = scheduleArray.find(s => 
                                      s.day?.toLowerCase() === day && s.time === time
                                    );
                                    return `${slot?.duration || 60}min`;
                                  })()}
                                </Badge>
                                {userRole === 'admin' && (
                                  <Badge variant="outline" className="text-xs">
                                    <Users className="w-3 h-3 mr-1" />
                                    {getEnrollmentCount(classForSlot)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/50">
                            <span className="text-xs">—</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Legend */}
        {filteredClasses.length > 0 && (
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-semibold mb-3">Classes Overview:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredClasses.map(classItem => (
                <div key={classItem.id} className="flex items-center gap-3 text-sm">
                  <div className="w-4 h-4 bg-primary/20 border border-primary/40 rounded"></div>
                  <span className="font-medium">{classItem.name}</span>
                  <span className="text-muted-foreground">({classItem.teacher?.name})</span>
                  {userRole === 'admin' && (
                    <Badge variant="outline" className="text-xs">
                      {getEnrollmentCount(classItem)} students
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklySchedule;