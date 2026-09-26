import { asyncHandler } from "../utils/asyncHandler.js";
import { SupportTicket, User } from "../models/index.js";
import { getPharmacyDbId } from "../utils/tenantContext.js";
import Joi from "joi";

const ticketSchema = Joi.object({
  subject: Joi.string().min(3).max(255).required(),
  message: Joi.string().min(10).max(5000).required()
});

/**
 * POST /api/v1/support
 * Submit a help/support ticket.
 */
export const submitTicket = asyncHandler(async (req, res) => {
  const { error, value } = ticketSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message).join("; ");
    return res.status(400).json({ success: false, message: messages });
  }

  const pharmacyDbId = getPharmacyDbId();
  const userId = req.user.sub;

  const ticket = await SupportTicket.create({
    pharmacyId: pharmacyDbId,
    userId,
    subject: value.subject,
    message: value.message,
    status: "open"
  });

  return res.status(201).json({
    success: true,
    message: "Support ticket submitted successfully.",
    data: {
      _id: ticket._id,
      id: ticket._id,
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.createdAt
    }
  });
});

/**
 * GET /api/v1/support
 * List all support tickets for the current pharmacy (Admin only).
 */
export const listTickets = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const { status, search } = req.query;

  const queryObj = { pharmacyId: pharmacyDbId };
  if (status && ["open", "closed"].includes(status)) {
    queryObj.status = status;
  }

  if (search && search.trim()) {
    const term = search.trim();
    const matchedUsers = await User.find({
      pharmacyId: pharmacyDbId,
      $or: [
        { name: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } }
      ]
    }).select("_id");
    const userIds = matchedUsers.map((u) => u._id);

    queryObj.$or = [
      { subject: { $regex: term, $options: "i" } },
      { message: { $regex: term, $options: "i" } },
      { userId: { $in: userIds } }
    ];
  }

  const tickets = await SupportTicket.find(queryObj)
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .limit(200);

  const formatted = tickets.map((t) => ({
    _id: t._id,
    id: t._id,
    subject: t.subject,
    message: t.message,
    status: t.status,
    createdAt: t.createdAt,
    closedAt: t.closedAt,
    user_name: t.userId?.name || "",
    user_email: t.userId?.email || ""
  }));

  return res.json({ success: true, data: formatted });
});

/**
 * PATCH /api/v1/support/:id/status
 * PUT /api/v1/support/:id
 * Update status of a support ticket (open or closed) (Admin only).
 */
export const updateTicketStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !["open", "closed"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status is required and must be either 'open' or 'closed'."
    });
  }

  const pharmacyDbId = getPharmacyDbId();
  const ticket = await SupportTicket.findOne({ _id: id, pharmacyId: pharmacyDbId }).populate("userId", "name email");

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: "Support ticket not found."
    });
  }

  ticket.status = status;
  ticket.closedAt = status === "closed" ? new Date() : null;
  ticket.closedBy = status === "closed" ? req.user?.sub : null;
  await ticket.save();

  return res.json({
    success: true,
    message: `Ticket status updated to ${status}.`,
    data: {
      _id: ticket._id,
      id: ticket._id,
      subject: ticket.subject,
      message: ticket.message,
      status: ticket.status,
      user_name: ticket.userId?.name || "",
      user_email: ticket.userId?.email || "",
      closedAt: ticket.closedAt,
      createdAt: ticket.createdAt
    }
  });
});
