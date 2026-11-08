import * as React from "react"
import { cn } from "cn"

function Card({
  className,
  layout = "default",
  ...props
}: React.ComponentProps<"div"> & { layout?: "default" | "list" }) {
  return (
    <div
      data-slot="card"
      data-layout={layout}
      className={cn("ui-card", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("ui-card-header", className)}
      {...props}
    />
  )
}

function CardTitle({ className, variant = "default", ...props }: React.ComponentProps<"h2"> & { variant?: "default" | "section" | "headline" }) {
  return (
    <h2
      data-slot="card-title"
      data-variant={variant}
      className={cn("ui-card-title", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("ui-card-description", className)}
      {...props}
    />
  )
}

function CardAction({ className, align = "center", ...props }: React.ComponentProps<"div"> & { align?: "center" | "title" }) {
  return (
    <div
      data-slot="card-action"
      data-align={align}
      className={cn("ui-card-action", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("ui-card-content", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("ui-card-footer", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
