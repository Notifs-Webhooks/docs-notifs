"""Tests for document contribution reporting."""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


def test_editor_can_report_contribution():
    """An editor can report a contribution without providing a user ID."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(
        document=document,
        user=user,
        role="editor",
    )

    client = APIClient()
    client.force_login(user)

    url = f"/api/v1.0/documents/{document.id!s}/contributions/"

    first_response = client.post(url)

    assert first_response.status_code == status.HTTP_201_CREATED
    assert first_response.json()["document_id"] == str(document.id)
    assert first_response.json()["user_id"] == str(user.id)

    contribution = models.DocumentContribution.objects.get()

    assert contribution.document == document
    assert contribution.user == user

    second_response = client.post(url)

    assert second_response.status_code == status.HTTP_200_OK
    assert models.DocumentContribution.objects.count() == 1


@pytest.mark.parametrize("role", ["reader", "commenter"])
def test_read_only_user_cannot_report_contribution(role):
    """A user without editing permission cannot report a contribution."""
    user = factories.UserFactory()
    document = factories.DocumentFactory(link_reach="restricted")
    factories.UserDocumentAccessFactory(
        document=document,
        user=user,
        role=role,
    )

    client = APIClient()
    client.force_login(user)

    response = client.post(
        f"/api/v1.0/documents/{document.id!s}/contributions/"
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert models.DocumentContribution.objects.count() == 0