import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { reportReasons, ReportReason } from "@shared/schema";

interface ReportModalProps {
  onClose: () => void;
  onSubmit: (data: { reason: ReportReason; details: string }) => void;
}

const reportSchema = z.object({
  reason: z.enum(reportReasons),
  details: z.string().optional(),
});

type ReportFormValues = z.infer<typeof reportSchema>;

const ReportModal: React.FC<ReportModalProps> = ({ onClose, onSubmit }) => {
  const { control, handleSubmit, formState: { errors, isValid } } = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reason: "inappropriate",
      details: "",
    },
  });

  const onSubmitForm = (data: ReportFormValues) => {
    onSubmit({
      reason: data.reason,
      details: data.details || "",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <CardContent className="p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Report User</h3>
          <p className="text-gray-600 mb-6">Please select a reason for reporting this user:</p>
          
          <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
            <Controller
              name="reason"
              control={control}
              render={({ field }) => (
                <RadioGroup 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="inappropriate" id="inappropriate" />
                    <Label htmlFor="inappropriate" className="font-normal">
                      Inappropriate content or behavior
                    </Label>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="spam" id="spam" />
                    <Label htmlFor="spam" className="font-normal">
                      Spam or advertising
                    </Label>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="offensive" id="offensive" />
                    <Label htmlFor="offensive" className="font-normal">
                      Offensive language or harassment
                    </Label>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other" className="font-normal">
                      Other
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />
            
            <div>
              <Controller
                name="details"
                control={control}
                render={({ field }) => (
                  <Textarea 
                    {...field}
                    rows={3}
                    className="w-full resize-none" 
                    placeholder="Additional details (optional)"
                  />
                )}
              />
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <Button 
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Report User
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportModal;
