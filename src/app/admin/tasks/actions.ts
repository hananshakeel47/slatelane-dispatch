"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createAdminSupabase,
} from "@/lib/supabase/admin";


export async function completeTaskAction(
  formData: FormData
) {
  const taskId =
    String(
      formData.get(
        "taskId"
      ) ?? ""
    ).trim();


  if (!taskId) {
    throw new Error(
      "Missing task ID."
    );
  }


  const supabase =
    createAdminSupabase();


  const now =
    new Date().toISOString();


  const {
    data: task,
    error: taskError,
  } = await supabase
    .from("lead_tasks")
    .select(`
      id,
      lead_id,
      status
    `)
    .eq(
      "id",
      taskId
    )
    .maybeSingle();


  if (
    taskError ||
    !task
  ) {
    throw new Error(
      taskError?.message ||
      "Task not found."
    );
  }


  if (
    task.status !==
    "open"
  ) {
    revalidatePath(
      "/admin/tasks"
    );

    return;
  }


  const {
    error,
  } = await supabase
    .from(
      "lead_tasks"
    )
    .update({
      status:
        "completed",

      completed_at:
        now,

      updated_at:
        now,
    })
    .eq(
      "id",
      taskId
    );


  if (error) {
    throw new Error(
      `Could not complete task: ${error.message}`
    );
  }


  revalidatePath(
    "/admin/tasks"
  );

  revalidatePath(
    "/admin/dashboard"
  );

  revalidatePath(
    "/admin/leads"
  );

  revalidatePath(
    `/admin/leads/${task.lead_id}`
  );
}


export async function cancelTaskAction(
  formData: FormData
) {
  const taskId =
    String(
      formData.get(
        "taskId"
      ) ?? ""
    ).trim();


  if (!taskId) {
    throw new Error(
      "Missing task ID."
    );
  }


  const supabase =
    createAdminSupabase();


  const now =
    new Date().toISOString();


  const {
    data: task,
    error: taskError,
  } = await supabase
    .from("lead_tasks")
    .select(`
      id,
      lead_id,
      status
    `)
    .eq(
      "id",
      taskId
    )
    .maybeSingle();


  if (
    taskError ||
    !task
  ) {
    throw new Error(
      taskError?.message ||
      "Task not found."
    );
  }


  if (
    task.status !==
    "open"
  ) {
    revalidatePath(
      "/admin/tasks"
    );

    return;
  }


  const {
    error,
  } = await supabase
    .from(
      "lead_tasks"
    )
    .update({
      status:
        "cancelled",

      completed_at:
        null,

      updated_at:
        now,
    })
    .eq(
      "id",
      taskId
    );


  if (error) {
    throw new Error(
      `Could not cancel task: ${error.message}`
    );
  }


  revalidatePath(
    "/admin/tasks"
  );

  revalidatePath(
    "/admin/dashboard"
  );

  revalidatePath(
    "/admin/leads"
  );

  revalidatePath(
    `/admin/leads/${task.lead_id}`
  );
}